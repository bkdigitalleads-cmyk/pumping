import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts, Theme } from '../theme';
import { IconTile, PillButton } from '../components';
import Icon, { IconName } from '../icons';
import { getOffering } from '../purchases';
import { getTrialEligibleIds, trialLabel } from '../trial';
import { requestReminderPermission } from '../reminder';

/**
 * First launch, in this order (App.tsx runs it):
 *   1-3. Welcome: three value screens, outcomes for the parent
 *   4-8. Onboarding.tsx: what matters most, daily plan, reminder style,
 *        current stash, where they heard about us
 *   a.   TrialSteps "Try Pumping Pro free"                  } only when RevenueCat says this
 *   b.   TrialSteps "We'll remind you before your trial ends" } Apple ID can get the free trial
 *   then the onboarding paywall.
 * In Free mode (Lifetime launch offer at 0) a and b are skipped.
 */
const VALUE: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'drop',
    title: 'See where your day stands at a glance.',
    body: 'Every session fills today’s ring, so you know how close you are to your goal without doing math at 3am.',
  },
  {
    icon: 'clock',
    title: 'The next pump, timed your way.',
    body: 'Reminders count from the start or the end of your last session. You pick, and you can change it any time.',
  },
  {
    icon: 'snowflake',
    title: 'A freezer stash you can trust.',
    body: 'Bags line up oldest first with a use-by date on each, so less goes to waste and anyone caring for your baby knows which one is next.',
  },
];

interface TrialOffer {
  /** "3 days free" */
  label: string;
  /** "$4.99/week" */
  then: string;
}

let offerPromise: Promise<TrialOffer | null> | null = null;

/** The trial to offer, or null when not eligible, in Free mode, or the store can't answer. */
async function loadTrialOffer(): Promise<TrialOffer | null> {
  const off = await getOffering();
  if (!off) return null;
  if (off.lifetime && off.lifetime.product.price === 0) return null;
  const pkg = off.weekly;
  if (!pkg) return null;
  const label = trialLabel(pkg, await getTrialEligibleIds([pkg]));
  if (!label) return null;
  return { label, then: `${pkg.product.priceString}/week` };
}

/** Starts the eligibility check early; it is ready long before the trial screen. */
function trialOffer(): Promise<TrialOffer | null> {
  if (!offerPromise) offerPromise = loadTrialOffer().catch(() => null);
  return offerPromise;
}

export default function Welcome({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState(0);

  useEffect(() => {
    trialOffer();
  }, []);

  const next = () => (step < VALUE.length - 1 ? setStep(step + 1) : onDone());
  const v = VALUE[step];

  return (
    <Screen
      theme={theme}
      icon={v.icon}
      title={v.title}
      body={v.body}
      dots={{ count: VALUE.length, active: step }}
      button="Continue"
      onPress={next}
    />
  );
}

/** The trial and reminder screens. Calls onDone right away when no trial is on offer. */
export function TrialSteps({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [offer, setOffer] = useState<TrialOffer | null | undefined>(undefined);
  const [step, setStep] = useState<'trial' | 'remind'>('trial');
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let live = true;
    trialOffer().then((o) => {
      if (!live) return;
      if (o) setOffer(o);
      else onDone();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (step === 'trial') {
    return (
      <Screen
        theme={theme}
        icon="key"
        title="Try Pumping Pro free"
        body={`${offer.label}, then ${offer.then}. Every session kept, your whole freezer stash, 90 days of trends, and PDFs for your lactation consultant or caregiver. Cancel anytime.`}
        button="Continue"
        onPress={() => setStep('remind')}
        noPayment
      />
    );
  }

  return (
    <Screen
      theme={theme}
      icon="bell"
      title={'We’ll remind you before your trial ends'}
      body={'We’ll send you a reminder 1 day before your free trial ends, so there are no surprises.'}
      button="Continue"
      waiting={waiting}
      onPress={async () => {
        // Ask for notifications, then on to the paywall whatever the answer.
        setWaiting(true);
        await requestReminderPermission();
        setWaiting(false);
        onDone();
      }}
    />
  );
}

function Screen({
  theme,
  icon,
  title,
  body,
  dots,
  button,
  onPress,
  waiting = false,
  noPayment = false,
}: {
  theme: Theme;
  icon: IconName;
  title: string;
  body: string;
  dots?: { count: number; active: number };
  button: string;
  onPress: () => void;
  waiting?: boolean;
  noPayment?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <View style={styles.wrap}>
        <View style={styles.iconBadge}>
          <IconTile theme={theme} icon={icon} size={72} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
      </View>
      {dots && (
        <View style={styles.dots}>
          {Array.from({ length: dots.count }, (_, i) => (
            <View
              key={i}
              style={[styles.dash, { backgroundColor: i === dots.active ? theme.accent : theme.border }, i === dots.active && { width: 22 }]}
            />
          ))}
        </View>
      )}
      <View style={styles.footer}>
        {waiting ? (
          <ActivityIndicator color={theme.accent} style={{ height: 50 }} />
        ) : (
          <PillButton theme={theme} big label={button} onPress={onPress} />
        )}
        {noPayment && (
          <View style={styles.noPaymentRow}>
            <Icon name="check" size={15} color={theme.success} strokeWidth={2.5} />
            <Text style={[styles.noPayment, { color: theme.success }]}>No payment now</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  iconBadge: { marginBottom: 24 },
  title: { fontSize: 34, lineHeight: 40, fontFamily: fonts.display },
  body: { fontSize: 18, lineHeight: 26, marginTop: 14 },
  // Soft round dots, the active one a little drop wider.
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 },
  dash: { width: 9, height: 9, borderRadius: 5 },
  footer: { paddingHorizontal: 24, gap: 12 },
  noPaymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  noPayment: { fontSize: 13, textAlign: 'center', fontWeight: fonts.weight.semibold },
});
