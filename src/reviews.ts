import * as StoreReview from 'expo-store-review';
import { getOffering } from './purchases';
import { kvGet, kvSet } from './db';
import { todayIso } from './logic';

/**
 * App Store rating asks, at moments of value. Each trigger fires at most once
 * ever, at most one prompt per launch, and StoreKit still decides whether the
 * prompt is actually shown (it caps it at 3 a year).
 *   purchase  - right after a trial or purchase from the onboarding paywall
 *   laterDay  - first launch on a later calendar day than install
 *   session5  - after the 5th saved session
 * Never while the Lifetime price is $0 (a launch offer), or while the store
 * can't say what it is. Same engine as Odo 1.0.6.
 */
export type ReviewTrigger = 'purchase' | 'laterDay' | 'session5';

const triggerKey = (t: ReviewTrigger) => `review.${t}`;
const INSTALL_DAY_KEY = 'review.installDay';

let launchState: 'idle' | 'checking' | 'asked' = 'idle';
let launchChecked = false;

/** Free mode: the Lifetime price is 0. Unknown counts as Free, so we never risk a prompt then. */
async function isFreeMode(): Promise<boolean> {
  const off = await getOffering();
  return !off || (off.lifetime != null && off.lifetime.product.price === 0);
}

export async function maybeRequestReview(trigger: ReviewTrigger): Promise<void> {
  if (launchState !== 'idle') return;
  launchState = 'checking';
  try {
    if (await kvGet(triggerKey(trigger))) return;
    if (await isFreeMode()) return;
    if (!(await StoreReview.hasAction())) return;
    await kvSet(triggerKey(trigger), '1');
    launchState = 'asked';
    setTimeout(() => {
      StoreReview.requestReview().catch(() => {});
    }, 1200);
  } catch {
    // never let review plumbing affect the log
  } finally {
    if (launchState === 'checking') launchState = 'idle';
  }
}

/** After a session is saved; sessionCount includes it. */
export async function maybeRequestReviewAfterSession(sessionCount: number): Promise<void> {
  if (sessionCount < 5) return;
  await maybeRequestReview('session5');
}

/** Once per cold launch, from the main screen: records the install day, and asks on the first later day. */
export async function maybeRequestReviewOnLaunch(): Promise<void> {
  if (launchChecked) return;
  launchChecked = true;
  try {
    const today = todayIso();
    const installDay = await kvGet(INSTALL_DAY_KEY);
    if (!installDay) {
      await kvSet(INSTALL_DAY_KEY, today);
      return;
    }
    if (installDay !== today) await maybeRequestReview('laterDay');
  } catch {
    // never let review plumbing affect the log
  }
}
