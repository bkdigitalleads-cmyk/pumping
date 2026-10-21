/**
 * Local notifications only; nothing is sent from a server.
 *  - next-pump reminder: one notification at the next pump time, counted
 *    from the START or the END of the last session (the user's choice),
 *    rescheduled whenever a session is saved, edited or deleted, a reminder
 *    setting changes, or the app comes back to the foreground. None while a
 *    session is in progress.
 *  - trial reminder: "trial ends tomorrow", promised on the onboarding
 *    reminder screen, scheduled only once a free trial has started.
 */
import * as Notifications from 'expo-notifications';
import Purchases from 'react-native-purchases';
import { ENTITLEMENT_ID, isBillingAvailable } from './purchases';
import { getLastSession } from './db';
import { fmtIntervalWords, nextPumpAt, ReminderAnchor, reminderFireAt } from './logic';

const PUMP_ID = 'pumping.nextPump';
const TRIAL_ID = 'pumping.trialReminder';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// If the app happens to be open when a reminder fires, still show it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** True when notifications are allowed. Asks only if iOS has not asked yet. Never throws. */
export async function requestReminderPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return res.granted;
  } catch {
    return false;
  }
}

// ---------- next-pump reminder ----------

interface ReminderSettings {
  reminderEnabled: boolean;
  reminderIntervalMin: number;
  reminderAnchor: ReminderAnchor;
}

export async function cancelPumpReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(PUMP_ID);
  } catch {
    // nothing scheduled, or notifications unavailable
  }
}

/** Schedules (or replaces, or cancels) the next-pump reminder. Never throws. */
export async function syncPumpReminder(s: ReminderSettings, sessionInProgress: boolean): Promise<void> {
  try {
    if (!s.reminderEnabled || sessionInProgress) return await cancelPumpReminder();
    const last = await getLastSession();
    const fireAt = reminderFireAt(nextPumpAt(last, s.reminderIntervalMin, s.reminderAnchor), Date.now());
    if (fireAt == null || !last) return await cancelPumpReminder();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return await cancelPumpReminder();
    await Notifications.scheduleNotificationAsync({
      identifier: PUMP_ID,
      content: {
        title: 'Time to pump',
        body: `It has been ${fmtIntervalWords(s.reminderIntervalMin)} since your last session ${
          s.reminderAnchor === 'start' ? 'started' : 'ended'
        }.`,
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  } catch {
    // reminders are a convenience; never let them break the log
  }
}

// ---------- trial reminder (same as Odo 1.0.6) ----------

interface TrialState {
  active: boolean;
  willRenew: boolean;
  expiresMs: number | null;
}

/** The pro entitlement's trial state, or null when RevenueCat can't answer (offline, not configured). */
async function getTrialState(): Promise<TrialState | null> {
  if (!isBillingAvailable()) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    const ent = info.entitlements.active[ENTITLEMENT_ID];
    if (!ent || ent.periodType !== 'TRIAL') return { active: false, willRenew: false, expiresMs: null };
    const expiresMs = ent.expirationDate ? Date.parse(ent.expirationDate) : NaN;
    return { active: true, willRenew: ent.willRenew, expiresMs: Number.isFinite(expiresMs) ? expiresMs : null };
  } catch {
    return null;
  }
}

/**
 * After a successful purchase: if it started a free trial and notifications
 * are allowed, schedule the reminder for 1 day before the trial ends.
 * Returns true when a reminder was scheduled. Never asks for permission.
 */
export async function scheduleTrialReminderIfTrial(): Promise<boolean> {
  const trial = await getTrialState();
  if (!trial?.active || !trial.willRenew) return false;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;
    const now = Date.now();
    // 1 day before the trial ends (48 hours in for the 3-day trial). Sandbox
    // trials last minutes, so there fall back to 48 hours from now; the
    // foreground check below cancels it once the sandbox trial is over.
    let fireAt = trial.expiresMs != null ? trial.expiresMs - DAY : now + 2 * DAY;
    if (fireAt < now + HOUR) fireAt = now + 2 * DAY;
    await cancelTrialReminder();
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_ID,
      content: {
        title: 'Your free trial ends tomorrow',
        body: 'Pumping Pro renews tomorrow. Cancel anytime in Settings, Apple ID, Subscriptions.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelTrialReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ID);
  } catch {
    // nothing scheduled, or notifications unavailable
  }
}

/**
 * Foreground check: drop the trial reminder once the trial is over, or has
 * been cancelled (it would no longer renew). An unknown answer leaves it alone.
 */
export async function syncTrialReminder(): Promise<void> {
  const trial = await getTrialState();
  if (trial && (!trial.active || !trial.willRenew)) await cancelTrialReminder();
}
