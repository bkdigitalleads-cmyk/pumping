import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts, Theme } from '../theme';
import Icon, { IconName } from '../icons';
import Bottle from '../ui/Bottle';
import { Nudge, Tabs } from '../ui/List';
import { PillAction, Press } from '../ui/Press';
import { useApp, Focus } from '../state';
import { fmtVol, fromUnit, parseVolume, suggestedIntervalMin, toUnit, Unit, unitLabel, volNumber } from '../logic';

const FOCUS: { value: Exclude<Focus, ''>; label: string; sub: string; icon: IconName }[] = [
  { value: 'stash', label: 'Building a freezer stash', sub: 'Back to work soon, or just want a cushion', icon: 'snowflake' },
  { value: 'supply', label: 'Tracking my supply', sub: 'Ounces by day, and by side', icon: 'chart' },
  { value: 'drop', label: 'Dropping a pump', sub: 'Stretching the gaps, one session at a time', icon: 'clock' },
  { value: 'care', label: 'NICU or daycare', sub: 'Milk that someone else will feed', icon: 'heart' },
];

type Step = 'focus' | 'plan';

/**
 * The two setup questions after the welcome screen, then Today. Everything
 * here can be changed later in Settings. Since 1.0.1 the reminder question
 * comes when the first session ends (Session.tsx), milk already in the
 * freezer is added from the empty Stash, and "Where did you hear about us?"
 * is gone.
 */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { settings, updateSettings } = useApp();
  const [step, setStep] = useState<Step>('focus');
  const [unit, setUnit] = useState<Unit>(settings.unit);
  const [pumps, setPumps] = useState(settings.pumpsPerDay);
  const [goalMl, setGoalMl] = useState(settings.dailyGoalMl);

  const pickFocus = (f: Exclude<Focus, ''>) => {
    updateSettings({ focus: f }).catch(() => {});
    setStep('plan');
  };

  const savePlan = () => {
    // The reminder interval starts from the plan; the reminder question after the first session can change it.
    updateSettings({ unit, pumpsPerDay: pumps, dailyGoalMl: goalMl, reminderIntervalMin: suggestedIntervalMin(pumps) }).catch(() => {});
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

  // step === 'plan'
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
});
