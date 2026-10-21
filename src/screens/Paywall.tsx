import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useTheme, fonts, radius, Theme } from '../theme';
import Icon from '../icons';
import { useApp, Focus, FREE_BAG_LIMIT, FREE_SESSION_LIMIT } from '../state';
import { getOffering, purchasePackage, restorePurchases, isBillingAvailable } from '../purchases';
import { getTrialEligibleIds, trialLabel } from '../trial';
import { cancelTrialReminder, scheduleTrialReminderIfTrial } from '../reminder';
import { maybeRequestReview } from '../reviews';
import { TERMS_URL } from '../links';
import MiniSheet from '../ui/MiniSheet';
import { PillAction, Press, RoundButton } from '../ui/Press';

/** On the first-launch paywall the close button appears after this delay. */
const ONBOARDING_CLOSE_DELAY_MS = 3000;

/** The Lifetime product's name in the app. Its price always comes from StoreKit. */
const PASS = 'Pumping Pass';

function perWeek(pkg: PurchasesPackage | undefined): string {
  return pkg ? `${pkg.product.priceString}/week` : '';
}

/** One line that speaks to what the parent said matters most in onboarding. */
const FOCUS_LINE: Record<Focus, string> = {
  care: 'The caregiver sheet is ready to print for the daycare.',
  stash: 'Every bag, oldest first, with use-by dates.',
  supply: 'Your daily totals, side by side, for as far back as you need.',
  drop: 'See what each dropped pump does to the day total.',
  '': 'Every session and every bag, kept.',
};

/**
 * Two paywalls in one component (same pattern as Odo 1.0.6). Products:
 * pumping_pro_weekly ($rc_weekly, 3-day free trial) and pumping_pro_lifetime
 * ($rc_lifetime, the Pumping Pass). No yearly plan.
 *  - onboarding: the first-launch paywall after the trial and reminder
 *    screens. Weekly is preselected, trial wording shows only when this Apple
 *    ID can get the trial, and the close button appears after 3 seconds.
 *  - in-app (session or bag limit, 30/90 days, PDFs, Pro links): the
 *    Pumping Pass is preselected and listed first, and no trial is advertised.
 * While the Lifetime price is 0 (a launch offer) the free Lifetime leads.
 *
 * The hero is not a feature list: it is a small real copy of one of the Pro
 * PDFs, with the parent's own numbers when there are any.
 */
export default function PaywallModal({ privacyUrl, onboarding = false }: { privacyUrl: string; onboarding?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { paywallVisible, hidePaywall, setIsPro, settings } = useApp();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  // Product ids whose free trial this Apple ID can still get (RevenueCat eligibility check).
  const [trialEligible, setTrialEligible] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [canClose, setCanClose] = useState(!onboarding);

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
        'Pro is on',
        `Every session and every bag is kept now.${
          reminded ? ' We will remind you the day before the trial ends.' : ''
        }`,
        [{ text: 'OK', onPress: () => onboarding && maybeRequestReview('purchase') }]
      );
    } else if (res.ok) {
      // The store took the purchase but Pro isn't showing yet (it can lag).
      Alert.alert(
        'Paid, but Pro is not showing',
        'The App Store can lag a minute. Tap Restore purchases in a moment and it turns on.'
      );
    } else if (!res.userCancelled && res.error) {
      Alert.alert('The purchase did not go through', res.error);
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
      Alert.alert('Pro is back on', 'Every session and bag is yours again.');
    } else if (res.ok) {
      Alert.alert('Nothing to restore', 'This Apple ID has no Pumping Pro purchase.');
    } else {
      Alert.alert('Restore did not work', res.error ?? 'Try once more.');
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

  const sheetKind = settings.focus === 'care' || settings.focus === 'stash' ? 'caregiver' : 'supply';
  const heroTrial = showTrial(weeklyTrial);
  const headline = lifetimeFree
    ? 'Pro is free right now.'
    : heroTrial
      ? `Keep all of it. ${heroTrial[0].toUpperCase()}${heroTrial.slice(1)} first.`
      : 'Keep all of it.';

  return (
    <Modal visible={paywallVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => canClose && hidePaywall()}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Holds its space while hidden so nothing jumps when the close button appears. */}
          <View style={[styles.closeRow, { opacity: canClose ? 1 : 0 }]} accessibilityElementsHidden={!canClose}>
            <RoundButton theme={theme} icon="close" label="Close" onPress={hidePaywall} disabled={!canClose} />
          </View>

          <MiniSheet theme={theme} kind={sheetKind} unit={settings.unit} />

          <Text style={[styles.title, { color: theme.ink }]} accessibilityRole="header">
            {headline}
          </Text>
          <Text style={[styles.focus, { color: theme.inkSoft }]}>{FOCUS_LINE[settings.focus]}</Text>
          <Text style={[styles.what, { color: theme.inkSoft }]}>
            Pro keeps every session past the first {FREE_SESSION_LIMIT}, holds the whole freezer instead of {FREE_BAG_LIMIT} bags, opens 30 and 90 days of
            trends, and makes the supply log and the caregiver sheet.
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.accent} />
          ) : packages.length === 0 || !isBillingAvailable() ? (
            <Text style={[styles.unavailable, { color: theme.inkSoft }]}>The App Store is not answering right now. Try again in a bit.</Text>
          ) : (
            <View style={[styles.plans, { borderTopColor: theme.rule }]} accessibilityRole="radiogroup">
              {packages.map((p) => {
                const on = selected?.identifier === p.identifier;
                const isLifetime = p.packageType === 'LIFETIME';
                const isWeekly = p.packageType === 'WEEKLY';
                const title = isWeekly ? 'Weekly' : isLifetime ? PASS : p.product.title;
                const wTrial = showTrial(weeklyTrial);
                // 3.1.2(c) on the row itself: trial length, then the price after it.
                const line = isWeekly
                  ? wTrial
                    ? `${wTrial}, then ${p.product.priceString} a week`
                    : `${p.product.priceString} a week${weeklyPerYear ? `, ${weeklyPerYear} if kept all year` : ''}`
                  : isLifetime
                    ? lifetimeFree
                      ? 'Free right now, keep it for good'
                      : 'One-time, yours to keep'
                    : '';
                return (
                  <Press
                    key={p.identifier}
                    onPress={() => setSelected(p)}
                    style={[styles.plan, { borderBottomColor: theme.rule, backgroundColor: on ? theme.accentSoft : 'transparent' }]}
                    pressedStyle={{ backgroundColor: theme.sunk }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${title}, ${line}, ${isLifetime && lifetimeFree ? 'free' : p.product.priceString}`}
                  >
                    <Radio theme={theme} on={on} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.planTitle, { color: theme.ink }]}>{title}</Text>
                      <Text style={[styles.planLine, { color: on ? theme.accent : theme.inkSoft }]}>{line}</Text>
                    </View>
                    <Text style={[styles.planPrice, { color: theme.ink }]}>{isLifetime && lifetimeFree ? 'Free' : p.product.priceString}</Text>
                  </Press>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={[styles.bottom, { borderTopColor: theme.rule, paddingBottom: Math.max(insets.bottom, 14) }]}>
          {/* The button says Continue, never Subscribe. */}
          <PillAction
            theme={theme}
            tall
            label={purchasing ? 'One moment' : lifetimeFree && selected?.packageType === 'LIFETIME' ? 'Get Pro free' : 'Continue'}
            onPress={buy}
            disabled={purchasing || !selected || loading}
          />
          {selected?.packageType === 'LIFETIME' ? (
            <CheckLine color={theme.success}>{lifetimeFree ? 'Free, no subscription' : 'One payment, no subscription'}</CheckLine>
          ) : selected && showTrial(trialLabel(selected, trialEligible)) ? (
            <CheckLine color={theme.success}>No payment now</CheckLine>
          ) : null}
          {/*
            App Review guideline 3.1.2(c): title, length, price and functional
            Terms of Use (EULA) + Privacy Policy links live in the app itself.
            Outside the ScrollView and outside the "offering loaded" branch on
            purpose: visible without scrolling, rendered even with no products.
          */}
          <Text style={[styles.legalText, { color: theme.inkFaint }]}>Pumping Pro. {disclosure}</Text>
          <View style={styles.legalLinks}>
            <Text style={[styles.legalLink, { color: theme.inkSoft }]} onPress={onRestore} accessibilityRole="button">
              {restoring ? 'Restoring' : 'Restore purchases'}
            </Text>
            <Text style={[styles.legalLink, { color: theme.inkSoft }]} onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
              Terms of Use (EULA)
            </Text>
            <Text style={[styles.legalLink, { color: theme.inkSoft }]} onPress={() => Linking.openURL(privacyUrl)} accessibilityRole="link">
              Privacy Policy
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Radio({ theme, on }: { theme: Theme; on: boolean }) {
  return (
    <View style={[styles.radio, { borderColor: on ? theme.accent : theme.inkFaint }]}>
      {on && <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />}
    </View>
  );
}

function CheckLine({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={styles.checkLine}>
      <Icon name="check" size={15} color={color} strokeWidth={2.5} />
      <Text style={[styles.checkText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 24 },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: 14, paddingTop: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, marginTop: 22, paddingHorizontal: 20 },
  focus: { fontFamily: fonts.soft, fontSize: 18, lineHeight: 25, marginTop: 6, paddingHorizontal: 20 },
  what: { fontSize: 15, lineHeight: 22, marginTop: 10, paddingHorizontal: 20 },
  plans: { marginTop: 22, borderTopWidth: StyleSheet.hairlineWidth },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  planTitle: { fontFamily: fonts.heading, fontSize: 19 },
  planLine: { fontSize: 14, marginTop: 2, fontWeight: '600' },
  planPrice: { fontFamily: fonts.display, fontSize: 20 },
  radio: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill },
  unavailable: { textAlign: 'center', marginVertical: 24, fontSize: 15, paddingHorizontal: 20 },
  bottom: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  checkLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  checkText: { fontSize: 14, fontWeight: '600' },
  legalText: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  legalLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline', paddingVertical: 4 },
});
