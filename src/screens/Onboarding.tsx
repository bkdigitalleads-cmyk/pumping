import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, fonts, Theme } from '../theme';
import { IconTile, PillButton, Segmented, Stepper } from '../components';
import { IconName } from '../icons';
import { useApp, Focus } from '../state';
import { kvSet } from '../db';
import { requestReminderPermission } from '../reminder';
import {
  fmtInterval,
  fmtVol,
  fromUnit,
  parseVolume,
  ReminderAnchor,
  suggestedIntervalMin,
  toUnit,
  Unit,
  unitLabel,
  volNumber,
} from '../logic';

/** Stored on the phone only. Backup attribution, and a future paywall-routing signal. */
export const SOURCE_KEY = 'onboarding.source';

const SOURCES = ['App Store search', 'TikTok or Instagram', 'A friend or another parent', 'Hospital, NICU or lactation consultant', 'Somewhere else'];

const FOCUS: { value: Exclude<Focus, ''>; label: string; sub: string; icon: IconName }[] = [
  { value: 'stash', label: 'Building a freezer stash', sub: 'For back to work, or just peace of mind', icon: 'snowflake' },
  { value: 'supply', label: 'Tracking my supply', sub: 'Day by day, and side by side', icon: 'chart' },
  { value: 'drop', label: 'Dropping a pump', sub: 'Spacing sessions out, one at a time', icon: 'clock' },
  { value: 'care', label: 'NICU or daycare', sub: 'Milk that someone else will feed', icon: 'heart' },
];

type Step = 'focus' | 'plan' | 'remind' | 'stash' | 'source';

/** Setup questions after the value screens. Everything here can be changed later in Settings. */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { settings, updateSettings } = useApp();
  const [step, setStep] = useState<Step>('focus');
  const [unit, setUnit] = useState<Unit>(settings.unit);
  const [pumps, setPumps] = useState(settings.pumpsPerDay);
  const [goalMl, setGoalMl] = useState(settings.dailyGoalMl);
  const [anchor, setAnchor] = useState<ReminderAnchor>(settings.reminderAnchor);
  const [interval, setIntervalMin] = useState(settings.reminderIntervalMin);
  const [stashText, setStashText] = useState('');
  const [stashError, setStashError] = useState('');
  const [asking, setAsking] = useState(false);

  const pickFocus = (f: Exclude<Focus, ''>) => {
    updateSettings({ focus: f }).catch(() => {});
    setStep('plan');
  };

  const savePlan = () => {
    updateSettings({ unit, pumpsPerDay: pumps, dailyGoalMl: goalMl }).catch(() => {});
    setIntervalMin(suggestedIntervalMin(pumps));
    setStep('remind');
  };

  const saveRemind = async (turnOn: boolean) => {
    let enabled = false;
    if (turnOn) {
      setAsking(true);
      enabled = await requestReminderPermission();
      setAsking(false);
    }
    updateSettings({ reminderAnchor: anchor, reminderIntervalMin: interval, reminderEnabled: enabled }).catch(() => {});
    setStep('stash');
  };

  const saveStash = () => {
    const v = parseVolume(stashText, unit);
    if (stashText.trim() && v == null) {
      setStashError('Numbers only, like 40 or 40.5.');
      return;
    }
    if (v) updateSettings({ startingStashMl: v }).catch(() => {});
    setStep('source');
  };

  const pickSource = (s: string) => {
    kvSet(SOURCE_KEY, s).catch(() => {});
    onDone();
  };

  if (step === 'focus') {
    return (
      <Page theme={theme} icon="heart" title="What matters most right now?" body="We will set things up around it. You can change everything later.">
        <View style={styles.choices}>
          {FOCUS.map((f) => (
            <Choice key={f.value} theme={theme} label={f.label} sub={f.sub} icon={f.icon} onPress={() => pickFocus(f.value)} />
          ))}
        </View>
      </Page>
    );
  }

  if (step === 'plan') {
    const goalStep = unit === 'oz' ? 1 : 30;
    const perPump = goalMl / pumps;
    return (
      <Page
        theme={theme}
        icon="drop"
        title={settings.focus === 'drop' ? 'Where are you starting from?' : 'Your daily plan'}
        body="Your pumps a day and a daily goal. Pick what feels doable; there is no wrong number here."
        footer={<PillButton theme={theme} big label="Continue" onPress={savePlan} />}
      >
        <Segmented
          theme={theme}
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'oz', label: 'Ounces' },
            { value: 'ml', label: 'Milliliters' },
          ]}
        />
        <View style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Stepper theme={theme} size="small" label="Pumps a day" valueText={String(pumps)} onStep={(d) => setPumps((p) => Math.min(16, Math.max(1, p + d)))} />
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <Stepper
            theme={theme}
            size="small"
            label="Daily goal"
            valueText={volNumber(goalMl, unit)}
            unit={unitLabel(unit)}
            onStep={(d) =>
              setGoalMl((g) => {
                const k = Math.round(toUnit(g, unit) / goalStep) + d;
                return fromUnit(Math.max(1, k) * goalStep, unit);
              })
            }
            onTyped={(t) => {
              const v = parseVolume(t, unit);
              if (v != null && v > 0) setGoalMl(v);
            }}
          />
        </View>
        <Text style={[styles.projection, { color: theme.text }]}>
          {pumps} {pumps === 1 ? 'pump' : 'pumps'} a day at about {fmtVol(perPump, unit)} each reaches {fmtVol(goalMl, unit)}. That is about{' '}
          {fmtVol(goalMl * 7, unit)} a week.
        </Text>
      </Page>
    );
  }

  if (step === 'remind') {
    return (
      <Page
        theme={theme}
        icon="bell"
        title="When should we nudge you?"
        body="Count the time to your next pump from when your last session started, or from when it ended."
        footer={
          asking ? null : (
            <View style={{ gap: 10 }}>
              <PillButton theme={theme} big label="Turn on reminders" onPress={() => saveRemind(true)} />
              <Pressable onPress={() => saveRemind(false)} hitSlop={8} style={styles.skip}>
                <Text style={[styles.skipText, { color: theme.textSecondary }]}>Not now</Text>
              </Pressable>
            </View>
          )
        }
      >
        <Segmented
          theme={theme}
          value={anchor}
          onChange={setAnchor}
          options={[
            { value: 'start', label: 'From the start' },
            { value: 'end', label: 'From the end' },
          ]}
        />
        <View style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Stepper
            theme={theme}
            size="small"
            label="Every"
            valueText={fmtInterval(interval)}
            onStep={(d) => setIntervalMin((i) => Math.min(720, Math.max(30, i + d * 15)))}
          />
        </View>
        <Text style={[styles.projection, { color: theme.text }]}>
          {anchor === 'start'
            ? `Start at 9:00, and the next reminder comes ${fmtInterval(interval)} later, however long you pump.`
            : `Finish at 9:20, and the next reminder comes ${fmtInterval(interval)} after that.`}
        </Text>
      </Page>
    );
  }

  if (step === 'stash') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Page
          theme={theme}
          icon="snowflake"
          title="Any milk stored already?"
          body={`Add the rough total in ${unit === 'oz' ? 'ounces' : 'milliliters'}. You can add dated bags later, one by one.`}
          footer={
            <View style={{ gap: 10 }}>
              <PillButton theme={theme} big label="Save and continue" onPress={saveStash} />
              <Pressable onPress={() => setStep('source')} hitSlop={8} style={styles.skip}>
                <Text style={[styles.skipText, { color: theme.textSecondary }]}>Skip for now</Text>
              </Pressable>
            </View>
          }
        >
          <View style={styles.stashRow}>
            <TextInput
              style={[styles.stashInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              value={stashText}
              onChangeText={(t) => {
                setStashText(t);
                setStashError('');
              }}
              placeholder="0"
              placeholderTextColor={theme.textFaint}
              keyboardType="decimal-pad"
              maxLength={6}
              accessibilityLabel={`Stored milk in ${unitLabel(unit)}`}
            />
            <Text style={[styles.stashUnit, { color: theme.textSecondary }]}>{unitLabel(unit)}</Text>
          </View>
          <Text style={[styles.hint, { color: stashError ? theme.danger : theme.textFaint }]}>
            {stashError || 'Optional. Leave it empty if you are just starting out.'}
          </Text>
        </Page>
      </KeyboardAvoidingView>
    );
  }

  return (
    <Page theme={theme} icon="question" title="Where did you hear about us?" body="One tap. It helps us make the app better.">
      <View style={styles.choices}>
        {SOURCES.map((s) => (
          <Choice key={s} theme={theme} label={s} onPress={() => pickSource(s)} />
        ))}
      </View>
    </Page>
  );
}

function Page({
  theme,
  icon,
  title,
  body,
  children,
  footer,
}: {
  theme: Theme;
  icon: IconName;
  title: string;
  body: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <IconTile theme={theme} icon={icon} />
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
        <View style={{ marginTop: 24, gap: 16 }}>{children}</View>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

function Choice({ theme, label, sub, icon, onPress }: { theme: Theme; label: string; sub?: string; icon?: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? theme.accentSoft : theme.card, borderColor: theme.border }]}
    >
      {icon && <IconTile theme={theme} icon={icon} size={44} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceText, { color: theme.text }]}>{label}</Text>
        {sub ? <Text style={[styles.choiceSub, { color: theme.textFaint }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 30 },
  title: { fontSize: 32, lineHeight: 38, fontFamily: fonts.display, marginTop: 20 },
  body: { fontSize: 17, lineHeight: 24, marginTop: 10 },
  choices: { gap: 12 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  choiceText: { fontSize: 17, fontWeight: fonts.weight.semibold },
  choiceSub: { fontSize: 14, marginTop: 2 },
  box: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 18, gap: 16 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },
  projection: { fontFamily: fonts.soft, fontSize: 18, lineHeight: 26 },
  footer: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 8 },
  skip: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: 16, fontWeight: fonts.weight.semibold },
  stashRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stashInput: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, fontSize: 34, fontFamily: fonts.display },
  stashUnit: { fontSize: 20, fontFamily: fonts.heading },
  hint: { fontSize: 14 },
});
