import Constants from 'expo-constants';
import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts } from '../theme';
import { useApp } from '../state';
import { deleteAllData } from '../db';
import { restorePurchases, isBillingAvailable } from '../purchases';
import { requestReminderPermission, cancelTrialReminder } from '../reminder';
import { CDC_STORAGE_URL, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '../links';
import { DEFAULT_STORAGE, fmtHm, fmtInterval, fmtVol, fromUnit, nextPumpAt, parseVolume, toUnit, unitLabel, volNumber } from '../logic';
import { Entry, Nudge, Section, Tabs, ToggleEntry } from '../ui/List';
import { Press } from '../ui/Press';
import Icon from '../icons';

/** Goal and baby-need steps: 1 oz or 30 mL. */
const bigStep = (unit: 'oz' | 'ml') => (unit === 'oz' ? 1 : 30);

function stepBig(ml: number, dir: 1 | -1, unit: 'oz' | 'ml', min: number): number {
  const s = bigStep(unit);
  const k = toUnit(ml, unit) / s;
  const next = (dir > 0 ? Math.floor(k + 1e-6) + 1 : Math.ceil(k - 1e-6) - 1) * s;
  return fromUnit(Math.max(min, next), unit);
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateSettings, isPro, setIsPro, showPaywall, bumpData, clearActive } = useApp();
  const [busy, setBusy] = useState(false);
  const unit = settings.unit;

  const onToggleReminder = async (on: boolean) => {
    if (!on) return updateSettings({ reminderEnabled: false });
    const ok = await requestReminderPermission();
    if (!ok) {
      Alert.alert('Notifications are off for Pumping', 'Turn them on in iOS Settings and the reminder can reach you.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    updateSettings({ reminderEnabled: true });
  };

  const onRestore = async () => {
    if (!isBillingAvailable()) {
      Alert.alert('The App Store is not answering', 'Try again in a minute.');
      return;
    }
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok) {
      cancelTrialReminder();
      setIsPro(res.isPro);
      Alert.alert(
        res.isPro ? 'Pro is back on' : 'Nothing to restore',
        res.isPro ? 'Every session and bag is yours again.' : 'This Apple ID has no Pumping Pro purchase.'
      );
    } else {
      Alert.alert('Restore did not work', res.error ?? 'Try once more.');
    }
  };

  const onDeleteAll = () =>
    Alert.alert('Delete every session and bag?', 'It all comes off this iPhone and cannot be brought back.', [
      { text: 'Keep it all', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          await deleteAllData();
          await clearActive();
          await updateSettings({ startingStashMl: 0 });
          bumpData();
        },
      },
    ]);

  // A worked example for the start-or-end choice: a 9:00 to 9:20 session.
  const exStart = new Date(2026, 0, 5, 9, 0).getTime();
  const exNext = nextPumpAt({ startedAt: exStart, endedAt: exStart + 20 * 60_000 }, settings.reminderIntervalMin, settings.reminderAnchor);
  const storageChanged =
    settings.fridgeDays !== DEFAULT_STORAGE.fridgeDays ||
    settings.freezerMonths !== DEFAULT_STORAGE.freezerMonths ||
    settings.deepFreezerMonths !== DEFAULT_STORAGE.deepFreezerMonths;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 56 }} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <Text style={[styles.headline, { color: theme.ink }]} accessibilityRole="header">
          Settings.
        </Text>
      </View>

      {!isPro && (
        <Press onPress={showPaywall} accessibilityRole="button" style={[styles.band, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.bandText, { color: theme.ink }]}>
            <Text style={{ fontFamily: fonts.heading, color: theme.accent }}>Pumping Pro </Text>
            keeps every session, holds the whole freezer, and makes both PDFs.
          </Text>
          <Icon name="chevronRight" size={18} color={theme.accent} />
        </Press>
      )}

      <Section theme={theme} title="Ounces or milliliters">
        <View style={styles.tabsPad}>
          <Tabs
            theme={theme}
            value={unit}
            onChange={(u) => updateSettings({ unit: u })}
            options={[
              { value: 'oz', label: 'Ounces' },
              { value: 'ml', label: 'Milliliters' },
            ]}
          />
        </View>
      </Section>

      <Section theme={theme} title="Your day" note={`That works out to about ${fmtVol(settings.dailyGoalMl / settings.pumpsPerDay, unit)} a session.`}>
        <Nudge
          theme={theme}
          label="Daily goal"
          value={volNumber(settings.dailyGoalMl, unit)}
          unit={unitLabel(unit)}
          onStep={(d) => updateSettings({ dailyGoalMl: stepBig(settings.dailyGoalMl, d, unit, bigStep(unit)) })}
          onTyped={(t) => {
            const v = parseVolume(t, unit);
            if (v != null && v > 0) updateSettings({ dailyGoalMl: v });
          }}
        />
        <Nudge
          theme={theme}
          label="Pumps a day"
          value={String(settings.pumpsPerDay)}
          onStep={(d) => updateSettings({ pumpsPerDay: Math.min(16, Math.max(1, settings.pumpsPerDay + d)) })}
        />
      </Section>

      <Section
        theme={theme}
        title="Next-pump reminder"
        note={`A 9:00 to 9:20 session means a reminder at ${exNext ? fmtHm(exNext) : ''}.`}
      >
        <ToggleEntry theme={theme} label="Remind me" sub="One quiet notification on this phone" value={settings.reminderEnabled} onChange={onToggleReminder} />
        <View style={styles.tabsPad}>
          <Tabs
            theme={theme}
            value={settings.reminderAnchor}
            onChange={(a) => updateSettings({ reminderAnchor: a })}
            options={[
              { value: 'start', label: 'From the start' },
              { value: 'end', label: 'From the end' },
            ]}
          />
        </View>
        <Nudge
          theme={theme}
          label="Every"
          sub={`Counted from the ${settings.reminderAnchor} of the last session`}
          value={fmtInterval(settings.reminderIntervalMin)}
          onStep={(d) => updateSettings({ reminderIntervalMin: Math.min(720, Math.max(30, settings.reminderIntervalMin + d * 15)) })}
        />
      </Section>

      <Section theme={theme} title="How much baby takes a day" note="Optional. A number you pick, so the stash can say how many days it covers.">
        {settings.babyNeedMl == null ? (
          <Entry theme={theme} label="Add a daily amount" onPress={() => updateSettings({ babyNeedMl: fromUnit(unit === 'oz' ? 25 : 750, unit) })} />
        ) : (
          <>
            <Nudge
              theme={theme}
              label="A day"
              value={volNumber(settings.babyNeedMl, unit)}
              unit={unitLabel(unit)}
              onStep={(d) => updateSettings({ babyNeedMl: stepBig(settings.babyNeedMl ?? 0, d, unit, bigStep(unit)) })}
              onTyped={(t) => {
                const v = parseVolume(t, unit);
                if (v != null && v > 0) updateSettings({ babyNeedMl: v });
              }}
            />
            <Entry theme={theme} label="Clear it" chevron={false} onPress={() => updateSettings({ babyNeedMl: null })} />
          </>
        )}
      </Section>

      <Section theme={theme} title="How long milk keeps" note="These set the use-by date on every bag. Thawed milk counts as good for a day.">
        <Nudge
          theme={theme}
          label="Fridge"
          value={String(settings.fridgeDays)}
          unit={settings.fridgeDays === 1 ? 'day' : 'days'}
          onStep={(d) => updateSettings({ fridgeDays: Math.min(8, Math.max(1, settings.fridgeDays + d)) })}
        />
        <Nudge
          theme={theme}
          label="Freezer"
          value={String(settings.freezerMonths)}
          unit={settings.freezerMonths === 1 ? 'month' : 'months'}
          onStep={(d) => updateSettings({ freezerMonths: Math.min(12, Math.max(1, settings.freezerMonths + d)) })}
        />
        <Nudge
          theme={theme}
          label="Deep freezer"
          value={String(settings.deepFreezerMonths)}
          unit={settings.deepFreezerMonths === 1 ? 'month' : 'months'}
          onStep={(d) => updateSettings({ deepFreezerMonths: Math.min(24, Math.max(1, settings.deepFreezerMonths + d)) })}
        />
        <Entry theme={theme} label="CDC breast milk storage guidance" sub="Opens cdc.gov" onPress={() => Linking.openURL(CDC_STORAGE_URL)} />
        {storageChanged && (
          <Entry theme={theme} label="Back to 4 days, 6 and 12 months" chevron={false} onPress={() => updateSettings({ ...DEFAULT_STORAGE })} />
        )}
        <Text style={[styles.fine, { color: theme.inkFaint }]}>This is general guidance, not medical advice.</Text>
      </Section>

      <Section theme={theme} title="Your data" note="Works offline. Everything you log stays on this iPhone, and Pro can export a copy from Trends." />

      <Section theme={theme} title="Purchases and help">
        <Entry theme={theme} label={busy ? 'Restoring' : 'Restore purchases'} onPress={busy ? undefined : onRestore} />
        <Entry theme={theme} label="Terms of Use (EULA)" onPress={() => Linking.openURL(TERMS_URL)} />
        <Entry theme={theme} label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Entry theme={theme} label="Help and support" onPress={() => Linking.openURL(SUPPORT_URL)} />
      </Section>

      <Section theme={theme} title="Start over">
        <Entry theme={theme} label="Delete every session and bag" danger onPress={onDeleteAll} />
      </Section>

      <Text style={[styles.version, { color: theme.inkFaint }]}>
        Pumping {Constants.expoConfig?.version ?? ''}. Made in NYC, mostly at night.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 18 },
  headline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 37 },
  band: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bandText: { flex: 1, fontSize: 16, lineHeight: 22 },
  tabsPad: { paddingVertical: 10 },
  fine: { fontSize: 14, lineHeight: 19, paddingHorizontal: 20, paddingTop: 12 },
  version: { textAlign: 'center', marginTop: 32, fontSize: 13 },
});
