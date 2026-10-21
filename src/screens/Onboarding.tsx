import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts, Theme } from '../theme';
import Icon, { IconName } from '../icons';
import Bottle from '../ui/Bottle';
import ReminderDiagram from '../ui/ReminderDiagram';
import { Nudge, Tabs } from '../ui/List';
import { PillAction, Press, TextAction } from '../ui/Press';
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
  { value: 'stash', label: 'Building a freezer stash', sub: 'Back to work soon, or just want a cushion', icon: 'snowflake' },
  { value: 'supply', label: 'Tracking my supply', sub: 'Ounces by day, and by side', icon: 'chart' },
  { value: 'drop', label: 'Dropping a pump', sub: 'Stretching the gaps, one session at a time', icon: 'clock' },
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
      setStashError('Just the number, like 40 or 40.5.');
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
      <Page theme={theme} title="What matters most right now?" line="It changes a few words here and there. Everything can change later.">
        <List theme={theme}>
          {FOCUS.map((f) => (
            <Choice key={f.value} theme={theme} label={f.label} sub={f.sub} icon={f.icon} onPress={() => pickFocus(f.value)} />
          ))}
        </List>
      </Page>
    );
  }

  if (step === 'plan') {
    const goalStep = unit === 'oz' ? 1 : 30;
    const perPump = goalMl / pumps;
    return (
      <Page
        theme={theme}
        title={settings.focus === 'drop' ? 'Where are you starting from?' : 'How many pumps, and how much?'}
        line="A rough number is fine. No one is grading this."
        footer={<PillAction theme={theme} tall label="Continue" onPress={savePlan} />}
      >
        <View style={styles.planRow}>
          <Bottle theme={theme} totalMl={0} goalMl={goalMl} unit={unit} height={170} />
          <Text style={[styles.projection, { color: theme.ink }]}>
            {pumps} {pumps === 1 ? 'pump' : 'pumps'} at about {fmtVol(perPump, unit)} each gets you to {fmtVol(goalMl, unit)}. Around{' '}
            {fmtVol(goalMl * 7, unit)} a week.
          </Text>
        </View>
        <View style={{ paddingVertical: 8 }}>
          <Tabs
            theme={theme}
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'oz', label: 'Ounces' },
              { value: 'ml', label: 'Milliliters' },
            ]}
          />
        </View>
        <List theme={theme}>
          <Nudge theme={theme} label="Pumps a day" value={String(pumps)} onStep={(d) => setPumps((p) => Math.min(16, Math.max(1, p + d)))} />
          <Nudge
            theme={theme}
            label="Daily goal"
            value={volNumber(goalMl, unit)}
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
        </List>
      </Page>
    );
  }

  if (step === 'remind') {
    return (
      <Page
        theme={theme}
        title="Count from the start or the end?"
        footer={
          asking ? null : (
            <View style={{ gap: 4 }}>
              <PillAction theme={theme} tall label="Turn on reminders" onPress={() => saveRemind(true)} />
              <TextAction theme={theme} label="Not now" onPress={() => saveRemind(false)} color={theme.inkSoft} align="center" />
            </View>
          )
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <ReminderDiagram theme={theme} intervalMin={interval} anchor={anchor} />
        </View>
        <View style={{ paddingVertical: 8 }}>
          <Tabs
            theme={theme}
            value={anchor}
            onChange={setAnchor}
            options={[
              { value: 'start', label: 'From the start' },
              { value: 'end', label: 'From the end' },
            ]}
          />
        </View>
        <List theme={theme}>
          <Nudge theme={theme} label="Every" value={fmtInterval(interval)} onStep={(d) => setIntervalMin((i) => Math.min(720, Math.max(30, i + d * 15)))} />
        </List>
      </Page>
    );
  }

  if (step === 'stash') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Page
          theme={theme}
          title="Milk in the freezer already?"
          line="A rough total is fine. Dated bags can come later, one at a time."
          footer={
            <View style={{ gap: 4 }}>
              <PillAction theme={theme} tall label="Save and continue" onPress={saveStash} />
              <TextAction theme={theme} label="Skip for now" onPress={() => setStep('source')} color={theme.inkSoft} align="center" />
            </View>
          }
        >
          <View style={[styles.stashRow, { borderBottomColor: stashError ? theme.danger : theme.accent }]}>
            <TextInput
              style={[styles.stashInput, { color: theme.ink }]}
              value={stashText}
              onChangeText={(t) => {
                setStashText(t);
                setStashError('');
              }}
              placeholder="0"
              placeholderTextColor={theme.inkFaint}
              keyboardType="decimal-pad"
              maxLength={6}
              accessibilityLabel={`Stored milk in ${unitLabel(unit)}`}
            />
            <Text style={[styles.stashUnit, { color: theme.inkSoft }]}>{unitLabel(unit)}</Text>
          </View>
          <Text style={[styles.hint, { color: stashError ? theme.danger : theme.inkFaint }]}>
            {stashError || 'Leave it empty if the freezer is empty.'}
          </Text>
        </Page>
      </KeyboardAvoidingView>
    );
  }

  return (
    <Page theme={theme} title="Where did you hear about us?" line="One tap. It helps more than you would think.">
      <List theme={theme}>
        {SOURCES.map((s) => (
          <Choice key={s} theme={theme} label={s} onPress={() => pickSource(s)} />
        ))}
      </List>
    </Page>
  );
}

function Page({
  theme,
  title,
  line,
  children,
  footer,
}: {
  theme: Theme;
  title: string;
  line?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={[styles.title, { color: theme.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {line ? <Text style={[styles.line, { color: theme.inkSoft }]}>{line}</Text> : null}
        <View style={{ marginTop: 22, gap: 12 }}>{children}</View>
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View> : null}
    </View>
  );
}

/** Square-edged, full-bleed list with hairlines. */
function List({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule }}>{children}</View>;
}

function Choice({ theme, label, sub, icon, onPress }: { theme: Theme; label: string; sub?: string; icon?: IconName; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      style={[styles.choice, { borderBottomColor: theme.rule }]}
      pressedStyle={{ backgroundColor: theme.accentSoft }}
    >
      {icon && <Icon name={icon} size={24} color={theme.accent} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceText, { color: theme.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.choiceSub, { color: theme.inkFaint }]}>{sub}</Text> : null}
      </View>
      <Icon name="chevronRight" size={16} color={theme.inkFaint} />
    </Press>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 40, paddingBottom: 30 },
  title: { fontSize: 32, lineHeight: 38, fontFamily: fonts.display, paddingHorizontal: 24 },
  line: { fontSize: 17, lineHeight: 24, marginTop: 10, paddingHorizontal: 24 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 66, paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  choiceText: { fontSize: 17, fontWeight: fonts.weight.semibold },
  choiceSub: { fontSize: 14, marginTop: 2 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 24 },
  projection: { flex: 1, fontFamily: fonts.soft, fontSize: 19, lineHeight: 27 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  stashRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginHorizontal: 24, borderBottomWidth: 2 },
  stashInput: { flex: 1, paddingVertical: 8, fontSize: 48, fontFamily: fonts.display },
  stashUnit: { fontSize: 22, fontFamily: fonts.heading },
  hint: { fontSize: 15, paddingHorizontal: 24 },
});
