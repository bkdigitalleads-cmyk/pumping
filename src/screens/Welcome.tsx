import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme, fonts, Theme } from '../theme';
import Icon from '../icons';
import { useApp } from '../state';
import { getOffering } from '../purchases';
import { getTrialEligibleIds, trialLabel } from '../trial';
import { requestReminderPermission } from '../reminder';
import { addDays, addMonths, fmtShortDate, fromUnit, todayIso } from '../logic';
import Bottle from '../ui/Bottle';
import BagDrawing from '../ui/BagDrawing';
import ReminderDiagram from '../ui/ReminderDiagram';
import Tape, { Marker } from '../ui/Tape';
import { PillAction } from '../ui/Press';

/**
 * First launch, in this order (App.tsx runs it):
 *   1-3. Welcome: three value screens, each one drawing from the app and
 *        one short line (the bottle filling, a labeled bag, start or end)
 *   4-8. Onboarding.tsx: what matters most, daily plan, reminder style,
 *        current stash, where they heard about us
 *   a.   TrialSteps "Try Pumping Pro free"            } only when RevenueCat says this
 *   b.   TrialSteps "We'll remind you the day before"  } Apple ID can get the free trial
 *   then the onboarding paywall.
 * In Free mode (Lifetime launch offer at 0) a and b are skipped.
 */
const HEADLINES = [
  'Today’s ounces, at a glance.',
  'Every bag dated, oldest first.',
  'Count from the start or the end. Your call.',
];

interface TrialOffer {
  /** "3 days free" */
  label: string;
  /** "$4.99 a week" */
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
  return { label, then: `${pkg.product.priceString} a week` };
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

  const next = () => (step < HEADLINES.length - 1 ? setStep(step + 1) : onDone());

  return (
    <Page theme={theme} title={HEADLINES[step]} dots={{ count: HEADLINES.length, active: step }} button="Continue" onPress={next}>
      {step === 0 && <FillingBottle theme={theme} />}
      {step === 1 && <BagPair theme={theme} />}
      {step === 2 && (
        <View style={{ alignSelf: 'stretch', paddingHorizontal: 8 }}>
          <ReminderDiagram theme={theme} intervalMin={180} anchor={null} />
        </View>
      )}
    </Page>
  );
}

/** The bottle on Today, filling up once as the screen opens. */
function FillingBottle({ theme }: { theme: Theme }) {
  const { settings } = useApp();
  const goal = fromUnit(25, 'oz');
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setTotal(goal * 0.68), 450);
    return () => clearTimeout(t);
  }, [goal]);
  return <Bottle theme={theme} totalMl={total} goalMl={goal} unit={settings.unit} height={330} />;
}

/** Two labeled bags on a shelf, the older one taped "use next". */
function BagPair({ theme }: { theme: Theme }) {
  const t = todayIso();
  const older = addDays(t, -40);
  return (
    <View style={styles.bags} importantForAccessibility="no-hide-descendants">
      <BagDrawing theme={theme} width={136} number="#7" date={fmtShortDate(older)} amount="4½ oz" extra={`by ${fmtShortDate(addMonths(older, 6))}`} fill={0.75} frozen tape="use next" seed={7} />
      <BagDrawing theme={theme} width={136} number="#8" date={fmtShortDate(t)} amount="5 oz" extra={`by ${fmtShortDate(addMonths(t, 6))}`} fill={0.83} frozen seed={8} />
    </View>
  );
}

/** The trial and reminder screens. Calls onDone right away when no trial is on offer. */
export function TrialSteps({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { updateSettings } = useApp();
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
      <Page
        theme={theme}
        title={`Try Pumping Pro, ${offer.label}.`}
        line={`Then ${offer.then}. Cancel in Settings any time before it ends.`}
        button="Continue"
        onPress={() => setStep('remind')}
        noPayment
      >
        <Tape theme={theme} rotate={-3} seed={5}>
          <Marker theme={theme} size={58}>
            {offer.label}
          </Marker>
        </Tape>
      </Page>
    );
  }

  return (
    <Page
      theme={theme}
      title="We’ll remind you the day before it ends."
      button="Continue"
      waiting={waiting}
      onPress={async () => {
        // Ask for notifications, then on to the paywall whatever the answer.
        setWaiting(true);
        // Notifications allowed here (for example after "Not now" on the
        // reminder step) also turn the next-pump reminder on, so Settings
        // matches what iOS allows. It stays switchable in Settings.
        if (await requestReminderPermission()) await updateSettings({ reminderEnabled: true }).catch(() => {});
        setWaiting(false);
        onDone();
      }}
    >
      <TrialDays theme={theme} />
    </Page>
  );
}

/** Three days of a trial, the second one circled in marker with a bell. */
function TrialDays({ theme }: { theme: Theme }) {
  return (
    <View style={styles.days} accessible accessibilityLabel="Day 1, day 2 with the reminder, day 3">
      {['day 1', 'day 2', 'day 3'].map((d, i) => (
        <View key={d} style={styles.day}>
          <Svg width={86} height={86} style={StyleSheet.absoluteFill}>
            <Rect x={6} y={6} width={74} height={74} fill="none" stroke={theme.rule} strokeWidth={1.5} />
            {i === 1 && (
              <Path
                d="M43 4 C 70 2, 86 22, 82 46 C 78 72, 50 86, 26 78 C 6 70, 0 44, 10 24 C 18 10, 34 4, 52 6"
                fill="none"
                stroke={theme.accent}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
          </Svg>
          <Marker theme={theme} size={22} color={i === 1 ? theme.accent : theme.marker}>
            {d}
          </Marker>
          {i === 1 && <Icon name="bell" size={20} color={theme.accent} />}
        </View>
      ))}
    </View>
  );
}

/** One idea per screen: the drawing, a short headline, the dots and the button. */
function Page({
  theme,
  title,
  line,
  children,
  dots,
  button,
  onPress,
  waiting = false,
  noPayment = false,
}: {
  theme: Theme;
  title: string;
  line?: string;
  children: React.ReactNode;
  dots?: { count: number; active: number };
  button: string;
  onPress: () => void;
  waiting?: boolean;
  noPayment?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.hero}>{children}</View>
      <View style={styles.words}>
        <Text style={[styles.title, { color: theme.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {line ? <Text style={[styles.line, { color: theme.inkSoft }]}>{line}</Text> : null}
      </View>
      {dots && (
        <View style={styles.dots} accessible accessibilityLabel={`Page ${dots.active + 1} of ${dots.count}`}>
          {Array.from({ length: dots.count }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === dots.active ? theme.accent : theme.rule }, i === dots.active && { width: 22 }]} />
          ))}
        </View>
      )}
      <View style={styles.footer}>
        {waiting ? <ActivityIndicator color={theme.accent} style={{ height: 66 }} /> : <PillAction theme={theme} tall label={button} onPress={onPress} />}
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
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  words: { paddingHorizontal: 28, paddingBottom: 18 },
  title: { fontSize: 34, lineHeight: 40, fontFamily: fonts.display },
  line: { fontSize: 17, lineHeight: 24, marginTop: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  footer: { paddingHorizontal: 20, gap: 10 },
  noPaymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  noPayment: { fontSize: 14, textAlign: 'center', fontWeight: fonts.weight.semibold },
  bags: { flexDirection: 'row', gap: 22, alignItems: 'flex-end' },
  days: { flexDirection: 'row', gap: 14 },
  day: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center' },
});
