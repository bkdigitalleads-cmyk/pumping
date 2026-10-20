/**
 * Pure helpers with no React Native imports, so tests/logic.test.mjs can run
 * them in plain Node: units, dates, use-by dates, stash order and totals,
 * daily totals and the next-pump time. Volumes are always stored in mL.
 */

export const ML_PER_OZ = 29.5735;

export type Unit = 'oz' | 'ml';
export type BagLocation = 'fridge' | 'freezer' | 'deep_freezer';
export type ReminderAnchor = 'start' | 'end';

export const LOCATIONS: BagLocation[] = ['fridge', 'freezer', 'deep_freezer'];

export const LOCATION_LABEL: Record<BagLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  deep_freezer: 'Deep freezer',
};

export interface Session {
  id: number;
  /** Epoch ms. */
  startedAt: number;
  endedAt: number;
  durationSec: number;
  leftMl: number;
  rightMl: number;
  note: string;
}

export interface Bag {
  id: number;
  /** The number written on the bag. */
  labelNo: number;
  /** Day the milk was pumped, YYYY-MM-DD (local). */
  pumpedOn: string;
  volumeMl: number;
  location: BagLocation;
  /** Epoch ms of the last move to another location; null if it never moved. */
  movedAt: number | null;
  usedAt: number | null;
  discardedAt: number | null;
}

export interface StorageTimes {
  fridgeDays: number;
  freezerMonths: number;
  deepFreezerMonths: number;
}

/** Defaults the user can edit in Settings (general CDC guidance). */
export const DEFAULT_STORAGE: StorageTimes = { fridgeDays: 4, freezerMonths: 6, deepFreezerMonths: 12 };

/** Milk thawed in the fridge: use within 24 hours (counted as the next calendar day). */
export const THAWED_DAYS = 1;

// ---------- volumes ----------

export function toUnit(ml: number, unit: Unit): number {
  return unit === 'oz' ? ml / ML_PER_OZ : ml;
}

export function fromUnit(v: number, unit: Unit): number {
  return unit === 'oz' ? v * ML_PER_OZ : v;
}

/** The number shown for a volume: oz to 0.1, mL whole. */
export function volNumber(ml: number, unit: Unit): string {
  if (unit === 'ml') return String(Math.round(ml));
  const v = Math.round(toUnit(ml, 'oz') * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function unitLabel(unit: Unit): string {
  return unit === 'oz' ? 'oz' : 'mL';
}

/** "4.5 oz", "130 mL". */
export function fmtVol(ml: number, unit: Unit): string {
  return `${volNumber(ml, unit)} ${unitLabel(unit)}`;
}

/** Stepper step: 0.5 oz or 10 mL. */
export function volumeStep(unit: Unit): number {
  return unit === 'oz' ? 0.5 : 10;
}

/**
 * One stepper tap. Lands on the step grid (a typed 2.3 oz goes to 2.5 or 2),
 * never below zero.
 */
export function stepVolume(ml: number, dir: 1 | -1, unit: Unit): number {
  const step = volumeStep(unit);
  const k = toUnit(ml, unit) / step;
  const nextK = dir > 0 ? Math.floor(k + 1e-6) + 1 : Math.ceil(k - 1e-6) - 1;
  return nextK <= 0 ? 0 : fromUnit(nextK * step, unit);
}

/** Typed text in the user's unit ("4", "4.5", "4,5") to mL. Null when not a number. */
export function parseVolume(text: string, unit: Unit): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return fromUnit(n, unit);
}

// ---------- dates (local calendar days as YYYY-MM-DD) ----------

const pad = (n: number) => String(n).padStart(2, '0');

export function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoFromMs(ms: number): string {
  return isoFromDate(new Date(ms));
}

export function todayIso(now: number = Date.now()): string {
  return isoFromMs(now);
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** Local midnight of a calendar day, epoch ms. */
export function startOfDayMs(iso: string): number {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d).getTime();
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  return isoFromDate(new Date(y, m - 1, d + n));
}

/** Calendar months, clamped to the month's last day: Aug 31 + 6 months is Feb 28 (or 29). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const first = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return isoFromDate(new Date(first.getFullYear(), first.getMonth(), Math.min(d, lastDay)));
}

/** Whole days from a to b (b later is positive). DST-safe. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// ---------- stash ----------

export function isActive(b: Bag): boolean {
  return b.usedAt == null && b.discardedAt == null;
}

/** True when a fridge bag got there from a freezer, so the thawed-milk rule applies. */
export function isThawed(b: Bag): boolean {
  return b.location === 'fridge' && b.movedAt != null;
}

/**
 * Last good day for a bag, YYYY-MM-DD.
 *  - fridge, fresh: pumped day + fridge days
 *  - fridge, moved there from a freezer (thawing): the day after the move
 *  - freezer / deep freezer: pumped day + months for that freezer
 */
export function useBy(b: Bag, s: StorageTimes): string {
  if (isThawed(b)) return addDays(isoFromMs(b.movedAt as number), THAWED_DAYS);
  if (b.location === 'fridge') return addDays(b.pumpedOn, s.fridgeDays);
  if (b.location === 'freezer') return addMonths(b.pumpedOn, s.freezerMonths);
  return addMonths(b.pumpedOn, s.deepFreezerMonths);
}

export type BagStatus = 'ok' | 'soon' | 'expired';

/** Expired after the use-by day. "soon": 1 day left in the fridge, 14 days in a freezer. */
export function bagStatus(b: Bag, s: StorageTimes, today: string): BagStatus {
  const left = daysBetween(today, useBy(b, s));
  if (left < 0) return 'expired';
  if (left <= (b.location === 'fridge' ? 1 : 14)) return 'soon';
  return 'ok';
}

/**
 * Bags still in the stash, in use-next order: the earliest use-by first, then
 * the oldest pumped day, then the lower bag number. Within one location this
 * is first in, first out; a thawing bag in the fridge always comes first.
 */
export function stashOrder(bags: Bag[], s: StorageTimes): Bag[] {
  return bags
    .filter(isActive)
    .map((b) => ({ b, u: useBy(b, s) }))
    .sort(
      (x, y) =>
        x.u.localeCompare(y.u) || x.b.pumpedOn.localeCompare(y.b.pumpedOn) || x.b.labelNo - y.b.labelNo
    )
    .map((x) => x.b);
}

/** The bag to grab next: first in use-next order that is not past its use-by day. */
export function useNext(bags: Bag[], s: StorageTimes, today: string): Bag | null {
  return stashOrder(bags, s).find((b) => bagStatus(b, s, today) !== 'expired') ?? null;
}

export interface StashTotals {
  byLocation: Record<BagLocation, { ml: number; count: number }>;
  /** Good milk only: active bags not past use-by. */
  totalMl: number;
  count: number;
  expiredCount: number;
}

export function stashTotals(bags: Bag[], s: StorageTimes, today: string): StashTotals {
  const byLocation: StashTotals['byLocation'] = {
    fridge: { ml: 0, count: 0 },
    freezer: { ml: 0, count: 0 },
    deep_freezer: { ml: 0, count: 0 },
  };
  let totalMl = 0;
  let count = 0;
  let expiredCount = 0;
  for (const b of bags) {
    if (!isActive(b)) continue;
    if (bagStatus(b, s, today) === 'expired') {
      expiredCount++;
      continue;
    }
    byLocation[b.location].ml += b.volumeMl;
    byLocation[b.location].count++;
    totalMl += b.volumeMl;
    count++;
  }
  return { byLocation, totalMl, count, expiredCount };
}

/** Days the stash covers at the baby's daily need, to 0.1 day, rounded down. Null without a need. */
export function daysOfMilk(totalMl: number, needMl: number | null): number | null {
  if (!needMl || needMl <= 0) return null;
  return Math.floor((totalMl / needMl) * 10 + 1e-9) / 10;
}

/** The number for the next bag: one more than any bag ever saved. */
export function nextLabelNo(bags: Bag[]): number {
  return bags.reduce((m, b) => Math.max(m, b.labelNo), 0) + 1;
}

// ---------- sessions ----------

export function sessionMl(s: Pick<Session, 'leftMl' | 'rightMl'>): number {
  return s.leftMl + s.rightMl;
}

export interface DayTotal {
  date: string;
  totalMl: number;
  leftMl: number;
  rightMl: number;
  count: number;
}

/** One row per calendar day from `from` to `to` inclusive, oldest first. A session counts on the day it started. */
export function dailyTotals(sessions: Session[], from: string, to: string): DayTotal[] {
  const n = daysBetween(from, to) + 1;
  const rows: DayTotal[] = [];
  const index = new Map<string, DayTotal>();
  for (let i = 0; i < n; i++) {
    const row = { date: addDays(from, i), totalMl: 0, leftMl: 0, rightMl: 0, count: 0 };
    rows.push(row);
    index.set(row.date, row);
  }
  for (const s of sessions) {
    const row = index.get(isoFromMs(s.startedAt));
    if (!row) continue;
    row.leftMl += s.leftMl;
    row.rightMl += s.rightMl;
    row.totalMl += s.leftMl + s.rightMl;
    row.count++;
  }
  return rows;
}

export interface Summary {
  totalMl: number;
  sessions: number;
  /** Days with at least one session. */
  daysLogged: number;
  /** Average over the days logged, not the empty ones. */
  avgPerDayMl: number;
  avgPerSessionMl: number;
  avgSessionsPerDay: number;
  leftMl: number;
  rightMl: number;
  /** Share of the volume from the left side, 0 to 100; null when nothing was logged. */
  leftPct: number | null;
  bestDay: DayTotal | null;
}

export function summarize(rows: DayTotal[]): Summary {
  let totalMl = 0;
  let sessions = 0;
  let daysLogged = 0;
  let leftMl = 0;
  let rightMl = 0;
  let bestDay: DayTotal | null = null;
  for (const r of rows) {
    totalMl += r.totalMl;
    sessions += r.count;
    leftMl += r.leftMl;
    rightMl += r.rightMl;
    if (r.count > 0) daysLogged++;
    if (r.totalMl > 0 && (!bestDay || r.totalMl > bestDay.totalMl)) bestDay = r;
  }
  return {
    totalMl,
    sessions,
    daysLogged,
    avgPerDayMl: daysLogged > 0 ? totalMl / daysLogged : 0,
    avgPerSessionMl: sessions > 0 ? totalMl / sessions : 0,
    avgSessionsPerDay: daysLogged > 0 ? sessions / daysLogged : 0,
    leftMl,
    rightMl,
    leftPct: leftMl + rightMl > 0 ? Math.round((leftMl / (leftMl + rightMl)) * 100) : null,
    bestDay,
  };
}

// ---------- reminders ----------

/**
 * When the next pump is due: the interval counted from the start or the end
 * of the last session, as the user chose. Null before the first session.
 */
export function nextPumpAt(
  last: Pick<Session, 'startedAt' | 'endedAt'> | null,
  intervalMin: number,
  anchor: ReminderAnchor
): number | null {
  if (!last || intervalMin <= 0) return null;
  return (anchor === 'start' ? last.startedAt : last.endedAt) + intervalMin * 60_000;
}

/** The notification time, or null when the pump is already due (nothing to schedule). */
export function reminderFireAt(next: number | null, now: number): number | null {
  if (next == null || next <= now + 30_000) return null;
  return next;
}

/** Evenly spaced pumps across 24 hours, to the nearest 15 minutes, between 1 and 12 hours. */
export function suggestedIntervalMin(pumpsPerDay: number): number {
  const raw = (24 * 60) / Math.max(1, pumpsPerDay);
  return Math.min(720, Math.max(60, Math.round(raw / 15) * 15));
}

// ---------- formatting ----------

/** "18 min", "1h 5m", "45 sec". */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

/** Timer face: "08:12", "1:02:05". */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

/** Interval in minutes: "3h", "2h 45m", "45 min". */
export function fmtInterval(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h}h` : `${h}h ${min % 60}m`;
}

/** Interval in words for a notification: "3 hours", "2 hours and 45 minutes". */
export function fmtIntervalWords(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h === 1 ? '1 hour' : `${h} hours`;
  const ms = m === 1 ? '1 minute' : `${m} minutes`;
  if (h === 0) return ms;
  return m === 0 ? hs : `${hs} and ${ms}`;
}

/** Countdown: "1h 42m", "12 min", "under a minute". */
export function fmtCountdown(ms: number): string {
  const min = Math.ceil(ms / 60_000);
  if (min <= 1) return 'under a minute';
  return fmtInterval(min);
}

// ---------- CSV ----------

const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';

function localStamp(ms: number): string {
  const d = new Date(ms);
  return `${isoFromDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Sessions as CSV (RFC 4180), oldest first, volumes in both units. */
export function sessionsCsv(sessions: Session[]): string {
  const lines = ['started,ended,minutes,left_ml,right_ml,total_ml,left_oz,right_oz,total_oz,note'];
  const oz = (ml: number) => (ml / ML_PER_OZ).toFixed(2);
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    lines.push(
      [
        localStamp(s.startedAt),
        localStamp(s.endedAt),
        String(Math.round(s.durationSec / 60)),
        String(Math.round(s.leftMl)),
        String(Math.round(s.rightMl)),
        String(Math.round(s.leftMl + s.rightMl)),
        oz(s.leftMl),
        oz(s.rightMl),
        oz(s.leftMl + s.rightMl),
        q(s.note),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

// ---------- display dates (en-US) ----------

/** "6:40 AM" */
export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "Tue, Oct 20" */
export function fmtDay(iso: string): string {
  return new Date(startOfDayMs(iso)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Oct 20, 2026" */
export function fmtDate(iso: string): string {
  return new Date(startOfDayMs(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Today", "Yesterday", or "Tue, Oct 20". */
export function fmtRelDay(iso: string, today: string): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return fmtDay(iso);
}
