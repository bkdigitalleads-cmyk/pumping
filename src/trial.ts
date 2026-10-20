/**
 * Free-trial wording is shown only when RevenueCat says this Apple ID can
 * still get the trial. Someone who already used it sees the plain price.
 */
import Purchases, { INTRO_ELIGIBILITY_STATUS, PurchasesPackage } from 'react-native-purchases';
import { isBillingAvailable } from './purchases';

/** Product ids among `pkgs` whose free trial this user can still get. Unknown counts as no. */
export async function getTrialEligibleIds(pkgs: PurchasesPackage[]): Promise<Set<string>> {
  const ids = pkgs.filter((p) => p.product.introPrice?.price === 0).map((p) => p.product.identifier);
  if (!isBillingAvailable() || ids.length === 0) return new Set();
  try {
    const res = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
    return new Set(
      ids.filter((id) => res[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE)
    );
  } catch {
    return new Set();
  }
}

/** "3 days free", or null when the package has no free trial or the user can't get it. */
export function trialLabel(pkg: PurchasesPackage | undefined, eligible: Set<string>): string | null {
  const intro = pkg?.product.introPrice;
  if (!pkg || !intro || intro.price !== 0 || !eligible.has(pkg.product.identifier)) return null;
  const n = intro.periodNumberOfUnits;
  const unit = intro.periodUnit.toLowerCase();
  return `${n} ${unit}${n === 1 ? '' : 's'} free`;
}
