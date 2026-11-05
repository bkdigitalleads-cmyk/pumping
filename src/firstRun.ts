/**
 * First-run moments from 1.0.1 on, kept as key/value rows (no table changes):
 *  - the free window: every session is free for FREE_DAYS from the first one
 *  - the trial screens and paywall after the first saved session, once ever
 *  - the paywall's second chance on a later calendar day, once ever
 * The decisions themselves are pure functions in logic.ts, with tests.
 */
import { getFirstSessionStart, kvGet, kvSet } from './db';
import { firstSessionAtFrom, secondChanceDue, todayIso } from './logic';

/** Start of the free window, epoch ms as text. */
export const FIRST_SESSION_KEY = 'free.firstSessionAt';
/** 'pending' from the end of onboarding until the first saved session, then 'done'. */
export const FIRST_FLOW_KEY = 'flow.afterFirstSession';
/** The day the after-first-session paywall was shown (YYYY-MM-DD), then 'done'. */
export const SECOND_CHANCE_KEY = 'flow.paywallSecondChance';

/** Start of the free window, or null before the first session. Never throws. */
export async function getFirstSessionAt(): Promise<number | null> {
  try {
    const stored = await kvGet(FIRST_SESSION_KEY);
    const at = firstSessionAtFrom(stored, stored ? null : await getFirstSessionStart());
    // Installs from before 1.0.1: the window counts from their first session, stored once.
    if (at != null && !stored) await kvSet(FIRST_SESSION_KEY, String(at));
    return at;
  } catch {
    return null;
  }
}

/**
 * After a new session is saved: starts the free window if it has not started.
 * A live session counts from its start; a session logged as past counts from
 * when it was logged, so filling in yesterday's pumps does not use up the days.
 */
export async function recordFirstSession(at: number): Promise<void> {
  try {
    if (!(await kvGet(FIRST_SESSION_KEY))) await kvSet(FIRST_SESSION_KEY, String(Math.min(at, Date.now())));
  } catch {
    // the window then counts from the earliest session instead
  }
}

/** True while the after-first-session moment is still to come (new installs only). */
export async function firstFlowPending(): Promise<boolean> {
  try {
    return (await kvGet(FIRST_FLOW_KEY)) === 'pending';
  } catch {
    return false;
  }
}

let secondChanceChecked = false;

/**
 * Once per cold launch, from the main screen: true when the in-app paywall
 * should open as the second chance. Consumes the flag when it is due, so it
 * happens once ever. A launch with a session running is skipped, not used up.
 */
export async function takeSecondChance(isPro: boolean, sessionRunning: boolean): Promise<boolean> {
  if (secondChanceChecked) return false;
  secondChanceChecked = true;
  if (sessionRunning) return false;
  try {
    if (!secondChanceDue(await kvGet(SECOND_CHANCE_KEY), todayIso())) return false;
    await kvSet(SECOND_CHANCE_KEY, 'done');
    return !isPro;
  } catch {
    return false;
  }
}
