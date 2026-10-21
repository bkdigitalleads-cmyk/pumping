import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { initPurchases, getIsPro, checkPro, onProChange } from './purchases';
import { kvAll, kvDelete, kvGet, kvSet } from './db';
import { DEFAULT_STORAGE, fromUnit, ReminderAnchor, StorageTimes, Unit } from './logic';
import { cancelPumpReminder, syncPumpReminder, syncTrialReminder } from './reminder';

/** Free tier. Pro removes all three. */
export const FREE_SESSION_LIMIT = 3;
export const FREE_BAG_LIMIT = 5;
export const FREE_TREND_DAYS = 7;

/** Onboarding answer to "What matters most right now?" */
export type Focus = '' | 'stash' | 'supply' | 'drop' | 'care';

export interface Settings extends StorageTimes {
  unit: Unit;
  dailyGoalMl: number;
  pumpsPerDay: number;
  reminderEnabled: boolean;
  reminderIntervalMin: number;
  /** Count the interval from the START or the END of the last session. */
  reminderAnchor: ReminderAnchor;
  /** Optional, a plain number the parent enters; drives "days of milk". */
  babyNeedMl: number | null;
  /**
   * Milk already stored when the app was set up, entered once in onboarding.
   * Kept here rather than as bags, since it has no dates; it counts in the
   * stash totals and shows as its own line until cleared.
   */
  startingStashMl: number;
  focus: Focus;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'oz',
  dailyGoalMl: fromUnit(25, 'oz'),
  pumpsPerDay: 8,
  reminderEnabled: false,
  reminderIntervalMin: 180,
  reminderAnchor: 'start',
  babyNeedMl: null,
  startingStashMl: 0,
  focus: '',
  ...DEFAULT_STORAGE,
};

const SETTING_PREFIX = 'setting.';
export const ONBOARDED_KEY = 'flag.onboarded';
const ACTIVE_KEY = 'activeSession';

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Settings from their stored rows, with defaults for anything missing or out of range. */
export function parseSettings(rows: Record<string, string>): Settings {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rows)) {
    try {
      raw[k] = JSON.parse(v);
    } catch {
      // one bad row falls back to its default
    }
  }
  const d = DEFAULT_SETTINGS;
  return {
    unit: raw.unit === 'ml' ? 'ml' : 'oz',
    dailyGoalMl: clamp(raw.dailyGoalMl, 30, 4000, d.dailyGoalMl),
    pumpsPerDay: Math.round(clamp(raw.pumpsPerDay, 1, 16, d.pumpsPerDay)),
    reminderEnabled: raw.reminderEnabled === true,
    reminderIntervalMin: Math.round(clamp(raw.reminderIntervalMin, 30, 720, d.reminderIntervalMin)),
    reminderAnchor: raw.reminderAnchor === 'end' ? 'end' : 'start',
    babyNeedMl: raw.babyNeedMl == null ? null : clamp(raw.babyNeedMl, 30, 4000, 0) || null,
    startingStashMl: clamp(raw.startingStashMl, 0, 200000, 0),
    focus: (['stash', 'supply', 'drop', 'care'] as const).find((f) => f === raw.focus) ?? '',
    fridgeDays: Math.round(clamp(raw.fridgeDays, 1, 8, d.fridgeDays)),
    freezerMonths: Math.round(clamp(raw.freezerMonths, 1, 12, d.freezerMonths)),
    deepFreezerMonths: Math.round(clamp(raw.deepFreezerMonths, 1, 24, d.deepFreezerMonths)),
  };
}

/** A session in progress. Saved on every change, so the timer survives an app switch or a relaunch. */
export interface ActiveSession {
  startedAt: number;
  leftMl: number;
  rightMl: number;
  note: string;
}

function parseActive(raw: string | null): ActiveSession | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw);
    if (!Number.isFinite(a?.startedAt)) return null;
    return {
      startedAt: a.startedAt,
      leftMl: Math.max(0, Number(a.leftMl) || 0),
      rightMl: Math.max(0, Number(a.rightMl) || 0),
      note: typeof a.note === 'string' ? a.note : '',
    };
  } catch {
    return null;
  }
}

interface AppState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  isPro: boolean;
  setIsPro: (v: boolean) => void;
  paywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
  active: ActiveSession | null;
  startSession: () => Promise<void>;
  updateActive: (patch: Partial<ActiveSession>) => void;
  clearActive: () => Promise<void>;
  ready: boolean;
  /** Bumped whenever sessions or bags change, so screens refetch. */
  dataVersion: number;
  bumpData: () => void;
  /** A one-line note at the bottom of the screen for a few seconds ("Logged. 4½ oz."). */
  notice: string | null;
  say: (text: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const activeRef = useRef<ActiveSession | null>(null);
  const [ready, setReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 3800);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = parseSettings(await kvAll(SETTING_PREFIX));
        settingsRef.current = s;
        setSettings(s);
        const a = parseActive(await kvGet(ACTIVE_KEY));
        activeRef.current = a;
        setActive(a);
      } catch {
        // unreadable storage -> defaults
      }
      try {
        await initPurchases();
        setIsPro(await getIsPro());
      } catch {
        setIsPro(false);
      }
      setReady(true);
    })();
  }, []);

  // Keep Pro in step with the store without a relaunch (renewals, expiries,
  // refunds), and re-check after a real trip to the background. The same
  // foreground check drops the trial reminder once the trial is over and
  // reschedules the next-pump reminder.
  useEffect(() => {
    if (!ready) return;
    syncTrialReminder();
    const unsubscribe = onProChange(setIsPro);
    let wasBackground = false;
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'background') wasBackground = true;
      if (s !== 'active' || !wasBackground) return;
      wasBackground = false;
      checkPro().then((v) => {
        if (v !== null) setIsPro(v);
      });
      syncTrialReminder();
      syncPumpReminder(settingsRef.current, activeRef.current != null);
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [ready]);

  // The next-pump reminder follows the last session and the reminder settings.
  const activeStart = active?.startedAt ?? 0;
  useEffect(() => {
    if (!ready) return;
    syncPumpReminder(settings, activeStart !== 0);
  }, [
    ready,
    dataVersion,
    activeStart,
    settings.reminderEnabled,
    settings.reminderIntervalMin,
    settings.reminderAnchor,
  ]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    try {
      for (const [k, v] of Object.entries(patch)) await kvSet(SETTING_PREFIX + k, JSON.stringify(v));
    } catch {
      // non-fatal: the value still applies for this launch
    }
  }, []);

  const startSession = useCallback(async () => {
    if (activeRef.current) return;
    const a: ActiveSession = { startedAt: Date.now(), leftMl: 0, rightMl: 0, note: '' };
    activeRef.current = a;
    setActive(a);
    cancelPumpReminder();
    await kvSet(ACTIVE_KEY, JSON.stringify(a)).catch(() => {});
  }, []);

  const updateActive = useCallback((patch: Partial<ActiveSession>) => {
    if (!activeRef.current) return;
    const a = { ...activeRef.current, ...patch };
    activeRef.current = a;
    setActive(a);
    kvSet(ACTIVE_KEY, JSON.stringify(a)).catch(() => {});
  }, []);

  const clearActive = useCallback(async () => {
    activeRef.current = null;
    setActive(null);
    await kvDelete(ACTIVE_KEY).catch(() => {});
  }, []);

  const value = useMemo<AppState>(
    () => ({
      settings,
      updateSettings,
      isPro,
      setIsPro,
      paywallVisible,
      showPaywall: () => setPaywallVisible(true),
      hidePaywall: () => setPaywallVisible(false),
      active,
      startSession,
      updateActive,
      clearActive,
      ready,
      dataVersion,
      bumpData: () => setDataVersion((v) => v + 1),
      notice,
      say,
    }),
    [settings, updateSettings, isPro, paywallVisible, active, startSession, updateActive, clearActive, ready, dataVersion, notice, say]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
