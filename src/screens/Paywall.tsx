import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useTheme, fonts } from '../theme';
import { PillButton } from '../components';
import Icon, { IconName } from '../icons';
import { useApp, FREE_BAG_LIMIT, FREE_SESSION_LIMIT } from '../state';
import {
  getOffering,
  purchasePackage,
  restorePurchases,
  isBillingAvailable,
} from '../purchases';
import { getTrialEligibleIds, trialLabel } from '../trial';
import { cancelTrialReminder, scheduleTrialReminderIfTrial } from '../reminder';
import { maybeRequestReview } from '../reviews';
import { TERMS_URL } from '../links';

/** On the first-launch paywall the close button appears after this delay. */
const ONBOARDING_CLOSE_DELAY_MS = 3000;

/** The Lifetime product's name in the app. Its price always comes from StoreKit. */
const PASS = 'Pumping Pass';

function perWeek(pkg: PurchasesPackage | undefined): string {
  return pkg ? `${pkg.product.priceString}/week` : '';
}

/**
 * Two paywalls in one component (same pattern as Odo 1.0.6). Products:
 * pumping_pro_weekly ($rc_weekly, 3-day free trial) and pumping_pro_lifetime
 * ($rc_lifetime, the Pumping Pass). No yearly plan.
 *  - onboarding: the first-launch paywall after the trial and reminder
 *    screens. Weekly is preselected, trial wording shows only when this Apple
 *    ID can get the trial, and the close button appears after 3 seconds.
 *  - in-app (session or bag limit, 30/90 days, PDFs, Pro buttons): the
 *    Pumping Pass is preselected and listed first, and no trial is advertised.
 * While the Lifetime price is 0 (a launch offer) the free Lifetime leads.
 */
export default function PaywallModal({ privacyUrl, onboarding = false }: { privacyUrl: string; onboarding?: boolean }) {
  const theme = useTheme();
  const { paywallVisible, hidePaywall, setIsPro } = useApp();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  // Product ids whose free trial this Apple ID can still get (RevenueCat eligibility check).
  const [trialEligible, setTrialEligible] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [canClose, setCanClose] = useState(!onboarding);

  // Copy lever 1: the word "free" sits next to a feature.
  const features: { icon: IconName; title: string; sub: string; free?: boolean }[] = [
    { icon: 'clock', title: 'Next-pump reminders', sub: 'Counted from the start or the end of your last session.', free: true },
    { icon: 'drop', title: 'Every session, kept', sub: `Free logs ${FREE_SESSION_LIMIT} sessions. Pro keeps them all.` },
    { icon: 'snowflake', title: 'Your whole stash', sub: `Free holds ${FREE_BAG_LIMIT} bags. Pro holds the whole freezer, oldest first.` },
    { icon: 'chart', title: '30 and 90 day trends', sub: 'Your daily totals over weeks, left and right.' },
    { icon: 'doc', title: 'Supply log and caregiver sheet', sub: 'PDFs for your lactation consultant, daycare, NICU or sitter.' },
  ];

  useEffect(() => {
    if (!paywallVisible || !onboarding) return;
    setCanClose(false);
    const t = setTimeout(() => setCanClose(true), ONBOARDING_CLOSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [paywallVisible, onboarding]);

  useEffect(() => {
    if (!paywallVisible) return;
    setLoading(true);
    (async () => {
      const off = await getOffering();
      setOffering(off);
      setTrialEligible(await getTrialEligibleIds(off?.availablePackages ?? []));
      // During a launch offer the Lifetime price is set to 0 in App Store Connect; then it leads.
      const freeLifetime = off?.lifetime && off.lifetime.product.price === 0 ? off.lifetime : null;
      const fallback = off?.availablePackages?.[0] ?? null;
      const primary =
        freeLifetime ??
        (onboarding
          ? // Weekly with 3 days free is the onboarding plan.
            off?.weekly ?? off?.lifetime ?? fallback
          : // In the app: one payment, yours to keep.
            off?.lifetime ?? off?.weekly ?? fallback);
      setSelected(primary);
      setLoading(false);
    })();
  }, [paywallVisible, onboarding]);

  const buy = async () => {
    if (!selected) return;
    setPurchasing(true);
    const res = await purchasePackage(selected);
    setPurchasing(false);
    if (res.ok && res.isPro) {
      setIsPro(true);
      hidePaywall();
      // Only does anything when this purchase started a free trial and notifications are allowed.
      const reminded = await scheduleTrialReminderIfTrial();
      Alert.alert(
        'You\u2019re all set',
        `Every session and every bag counts now.${
          reminded ? ' We\u2019ll remind you 1 day before your trial ends.' : ''
        }`,
        [{ text: 'OK', onPress: () => onboarding && maybeRequestReview('purchase') }]
      );
    } else if (res.ok) {
      // The store took the purchase but Pro isn't showing yet (it can lag).
      Alert.alert(
        'Almost there',
        'Your purchase went through but Pro isn\u2019t showing yet. Tap Restore purchases in a moment to turn it on.'
      );
    } else if (!res.userCancelled && res.error) {
      Alert.alert('Purchase failed', res.error);
    }
  };

  const onRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const res = await restorePurchases();
    setRestoring(false);
    if (res.ok) cancelTrialReminder();
    if (res.ok && res.isPro) {
      setIsPro(true);
      hidePaywall();
      Alert.alert('Restored', 'Your Pro purchase is active again.');
    } else if (res.ok) {
      Alert.alert('No purchases found', 'We couldn\u2019t find a previous Pro purchase on this Apple ID.');
    } else {
      Alert.alert('Restore failed', res.error ?? 'Please try again.');
    }
  };

  const lifetimeFree = (offering?.lifetime?.product.price ?? 1) === 0;
  // Onboarding: Weekly first, the Pumping Pass second. In the app: the Pumping Pass leads.
  // Lifetime always leads while it is free. Only Weekly and Lifetime are shown.
  const rank = (p: PurchasesPackage) =>
    p.packageType === 'LIFETIME' && (lifetimeFree || !onboarding) ? -1 : p.packageType === 'WEEKLY' ? 0 : 1;
  const packages = [...(offering?.availablePackages ?? [])]
    .filter((p) => p.packageType === 'WEEKLY' || p.packageType === 'LIFETIME')
    .sort((a, b) => rank(a) - rank(b));

  const weeklyPkg = packages.find((p) => p.packageType === 'WEEKLY');
  const lifetimePkg = packages.find((p) => p.packageType === 'LIFETIME');
  const weeklyTrial = trialLabel(weeklyPkg, trialEligible);
  // Trial wording in the headline, plan rows and button area: onboarding only.
  const showTrial = (label: string | null) => (onboarding ? label : null);

  const fmt = (n: number, cur?: string) =>
    n.toLocaleString(undefined, { style: 'currency', currency: cur ?? 'USD' });
  const weeklyPerYear = weeklyPkg?.product.price
    ? `${fmt(weeklyPkg.product.price * 52, weeklyPkg.product.currencyCode)}/yr`
    : null;

  // Always-visible 3.1.2(c) disclosure, built from whatever StoreKit returned.
  const disclosureParts: string[] = [];
  if (weeklyPkg)
    disclosureParts.push(
      `Weekly ${perWeek(weeklyPkg)} is an auto-renewing subscription billed once per week until cancelled${
        weeklyTrial ? `; it starts with ${weeklyTrial} and you are not charged until the trial ends` : ''
      }.`
    );
  if (lifetimePkg)
    disclosureParts.push(
      lifetimeFree
        ? `${PASS} (Lifetime) is a one-time purchase, free right now as a launch offer.`
        : `${PASS} (Lifetime) ${lifetimePkg.product.priceString} is a one-time purchase.`
    );
  const disclosure =
    (disclosureParts.length > 0
      ? disclosureParts.join(' ')
      : 'Pro is offered as a Weekly auto-renewing subscription or a one-time Lifetime purchase.') +
    ' Cancel anytime in your Apple ID settings.';

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => canClose && hidePaywall()}
    >
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Holds its space while hidden so nothing jumps when the close button appears. */}
          <Pressable
            onPress={hidePaywall}
            disabled={!canClose}
            hitSlop={12}
            style={[styles.close, { opacity: canClose ? 1 : 0 }]}
            accessibilityLabel="Close"
            accessibilityElementsHidden={!canClose}
          >
            <Icon name="close" size={22} color={theme.textFaint} />
          </Pressable>

          <Text style={[styles.title, { color: theme.text }]}>
            Every ounce,{'\n'}counted and kept
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {lifetimeFree
              ? 'Launch offer: Pro is free right now. Get it once and keep it forever.'
              : onboarding
                ? `${showTrial(weeklyTrial) ? `Start with ${weeklyTrial}. ` : ''}Log every session, keep your freezer stash in order, and share a clean supply log when you need one.`
                : `One ${PASS} covers your whole pumping journey. Every session, the whole stash and every PDF, yours to keep.`}
          </Text>

          <View style={styles.features}>
            {features.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Icon name={f.icon} size={22} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.featureTitleRow}>
                    <Text style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
                    {f.free && (
                      <View style={[styles.freeTag, { backgroundColor: theme.accentSoft }]}>
                        <Text style={[styles.freeTagText, { color: theme.accent }]}>FREE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.featureSub, { color: theme.textSecondary }]}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.accent} />
          ) : packages.length === 0 || !isBillingAvailable() ? (
            <Text style={[styles.unavailable, { color: theme.textSecondary }]}>
              Purchases aren’t available right now. Please try again later.
            </Text>
          ) : (
            <View style={styles.packages}>
              {packages.map((p) => {
                const active = selected?.identifier === p.identifier;
                const isLifetime = p.packageType === 'LIFETIME';
                const isWeekly = p.packageType === 'WEEKLY';
                const title = isWeekly ? 'Weekly' : isLifetime ? PASS : p.product.title;
                const wTrial = showTrial(weeklyTrial);
                // 3.1.2(c) on the row itself: trial length, then the price after it.
                const line = isWeekly
                  ? wTrial
                    ? `${wTrial}, then ${p.product.priceString}/week`
                    : `${p.product.priceString}/week`
                  : isLifetime
                    ? lifetimeFree
                      ? 'Free right now, keep forever'
                      : 'One-time, yours to keep'
                    : '';
                const tag = lifetimeFree
                  ? isLifetime && 'LAUNCH OFFER'
                  : onboarding
                    ? isWeekly && 'MOST POPULAR'
                    : isLifetime && 'BEST VALUE';
                return (
                  <Pressable
                    key={p.identifier}
                    onPress={() => setSelected(p)}
                    style={[
                      styles.pkg,
                      {
                        borderColor: active ? theme.accent : theme.border,
                        backgroundColor: active ? theme.accentSoft : theme.card,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.pkgTitleRow}>
                        <Text style={[styles.pkgTitle, { color: theme.text }]}>{title}</Text>
                        {tag ? (
                          <View style={[styles.popular, { backgroundColor: theme.accent }]}>
                            <Text style={[styles.popularText, { color: theme.onAccent }]}>{tag}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.pkgLine, { color: theme.accent }]}>
                        {line}
                      </Text>
                      {isWeekly && weeklyPerYear && (
                        <Text style={[styles.pkgEquiv, { color: theme.textFaint }]}>{weeklyPerYear} if kept all year</Text>
                      )}
                    </View>
                    <Text style={[styles.pkgPrice, { color: theme.text }]}>
                      {isLifetime && lifetimeFree ? 'Free' : p.product.priceString}
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {isWeekly ? '/wk' : ''}
                      </Text>
                    </Text>
                  </Pressable>
                );
              })}
              {/* Copy lever 2: the button says Continue, never Subscribe. */}
              <PillButton
                theme={theme}
                label={purchasing ? 'One moment…' : lifetimeFree && selected?.packageType === 'LIFETIME' ? 'Get Pro free' : 'Continue'}
                onPress={buy}
                disabled={purchasing || !selected}
              />
              {/* Copy lever 3: "No payment now" on trial tiers (onboarding, eligible only). */}
              {selected?.packageType === 'LIFETIME' ? (
                <CheckLine color={theme.success}>
                  {lifetimeFree ? 'Free, no subscription, yours for good' : 'One-time purchase, no subscription'}
                </CheckLine>
              ) : selected && showTrial(trialLabel(selected, trialEligible)) ? (
                <CheckLine color={theme.success}>No payment now</CheckLine>
              ) : null}
            </View>
          )}
        </ScrollView>

        {/*
          App Review guideline 3.1.2(c): title, length, price and functional
          Terms of Use (EULA) + Privacy Policy links live in the app itself.
          Outside the ScrollView and outside the "offering loaded" branch on
          purpose: visible without scrolling, rendered even with no products.
        */}
        <View style={[styles.legal, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
          <Text style={[styles.legalText, { color: theme.textSecondary }]}>
            Pumping Pro. {disclosure}
          </Text>
          <View style={styles.legalLinks}>
            <Text style={[styles.legalLink, { color: theme.accent }]} onPress={onRestore}>
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
            <Text style={[styles.legalDot, { color: theme.textFaint }]}>·</Text>
            <Text style={[styles.legalLink, { color: theme.accent }]} onPress={() => Linking.openURL(TERMS_URL)}>
              Terms of Use (EULA)
            </Text>
            <Text style={[styles.legalDot, { color: theme.textFaint }]}>·</Text>
            <Text style={[styles.legalLink, { color: theme.accent }]} onPress={() => Linking.openURL(privacyUrl)}>
              Privacy Policy
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CheckLine({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={styles.checkLine}>
      <Icon name="check" size={15} color={color} strokeWidth={2.5} />
      <Text style={[styles.noPayment, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  close: { alignSelf: 'flex-end', padding: 4 },
  title: { fontSize: 30, fontFamily: fonts.display, lineHeight: 34, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: 8, marginBottom: 22 },
  features: { gap: 14, marginBottom: 24 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  featureIcon: { width: 24, paddingTop: 1 },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureTitle: { fontSize: 16, fontWeight: fonts.weight.semibold },
  featureSub: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  freeTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  freeTagText: { fontSize: 10, fontWeight: fonts.weight.bold, letterSpacing: 0.5 },
  packages: { gap: 12 },
  pkg: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, padding: 16 },
  pkgTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pkgTitle: { fontSize: 16, fontWeight: fonts.weight.semibold },
  popular: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  popularText: { fontSize: 9, fontWeight: fonts.weight.bold, letterSpacing: 0.5 },
  pkgLine: { fontSize: 12, fontWeight: fonts.weight.semibold, marginTop: 3 },
  pkgEquiv: { fontSize: 11, marginTop: 2 },
  pkgPrice: { fontSize: 18, fontFamily: fonts.display, marginLeft: 10 },
  unavailable: { textAlign: 'center', marginVertical: 24, fontSize: 15 },
  checkLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  noPayment: { fontSize: 13, textAlign: 'center', fontWeight: fonts.weight.semibold },
  legal: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26, gap: 6 },
  legalText: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6 },
  legalLink: { fontSize: 12, fontWeight: fonts.weight.semibold, textDecorationLine: 'underline' },
  legalDot: { fontSize: 12 },
});
