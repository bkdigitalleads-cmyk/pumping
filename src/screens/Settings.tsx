import Constants from 'expo-constants';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme, fonts } from '../theme';
import { Card, PillButton, Row, SectionTitle, Segmented, Stepper } from '../components';
import { useApp } from '../state';
import { deleteAllData } from '../db';
import { restorePurchases, isBillingAvailable } from '../purchases';
import { requestReminderPermission, cancelTrialReminder } from '../reminder';
import { CDC_STORAGE_URL, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '../links';
import {
  DEFAULT_STORAGE,
  fmtInterval,
  fmtTime,
  fmtVol,
  fromUnit,
  nextPumpAt,
  parseVolume,
  toUnit,
  unitLabel,
  volNumber,
} from '../logic';

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
      Alert.alert('Notifications are off', 'Turn on notifications for Pumping in iOS Settings to get your reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    updateSettings({ reminderEnabled: true });
  };

  const onRestore = async () => {
    if (!isBillingAvailable()) {
      Alert.alert('Unavailable', 'Purchases are not available right now.');
      return;
    }
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok) {
      cancelTrialReminder();
      setIsPro(res.isPro);
      Alert.alert(
        res.isPro ? 'Restored' : 'No purchases found',
        res.isPro ? 'Your Pro access is back.' : 'We couldn’t find a previous purchase on this Apple ID.'
      );
    } else {
      Alert.alert('Restore failed', res.error ?? 'Please try again.');
    }
  };

  const onDeleteAll = () =>
    Alert.alert('Delete everything you logged?', 'Every session and bag is erased from this iPhone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
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

  // A worked example for the anchor choice: a 9:00 to 9:20 session.
  const exStart = new Date(2026, 0, 5, 9, 0).getTime();
  const exEnd = exStart + 20 * 60_000;
  const exNext = nextPumpAt({ startedAt: exStart, endedAt: exEnd }, settings.reminderIntervalMin, settings.reminderAnchor);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      {!isPro && (
        <Pressable onPress={showPaywall}>
          <Card theme={theme} style={{ ...styles.upsell, backgroundColor: theme.accentSoft }}>
            <Text style={[styles.upsellTitle, { color: theme.accent }]}>Pumping Pro</Text>
            <Text style={[styles.upsellSub, { color: theme.text }]}>
              Unlimited sessions, your whole stash, 30 and 90 day trends, the supply log and caregiver sheet PDFs.
            </Text>
          </Card>
        </Pressable>
      )}

      <SectionTitle theme={theme}>Units</SectionTitle>
      <Segmented
        theme={theme}
        value={unit}
        onChange={(u) => updateSettings({ unit: u })}
        options={[
          { value: 'oz', label: 'Ounces (oz)' },
          { value: 'ml', label: 'Milliliters (mL)' },
        ]}
      />

      <SectionTitle theme={theme}>Your day</SectionTitle>
      <Card theme={theme} style={{ gap: 18 }}>
        <Stepper
          theme={theme}
          size="small"
          label="Daily goal"
          valueText={volNumber(settings.dailyGoalMl, unit)}
          unit={unitLabel(unit)}
          onStep={(d) => updateSettings({ dailyGoalMl: stepBig(settings.dailyGoalMl, d, unit, bigStep(unit)) })}
          onTyped={(t) => {
            const v = parseVolume(t, unit);
            if (v != null && v > 0) updateSettings({ dailyGoalMl: v });
          }}
        />
        <Stepper
          theme={theme}
          size="small"
          label="Pumps a day"
          valueText={String(settings.pumpsPerDay)}
          onStep={(d) => updateSettings({ pumpsPerDay: Math.min(16, Math.max(1, settings.pumpsPerDay + d)) })}
        />
        <Text style={[styles.note, { color: theme.textFaint }]}>
          About {fmtVol(settings.dailyGoalMl / settings.pumpsPerDay, unit)} a session reaches your goal.
        </Text>
      </Card>

      <SectionTitle theme={theme}>Next-pump reminder</SectionTitle>
      <Card theme={theme} style={{ gap: 14 }}>
        <Row
          theme={theme}
          label="Remind me"
          right={
            <Switch
              value={settings.reminderEnabled}
              onValueChange={onToggleReminder}
              trackColor={{ true: theme.accent }}
              accessibilityLabel="Next-pump reminder"
            />
          }
        />
        <Segmented
          theme={theme}
          value={settings.reminderAnchor}
          onChange={(a) => updateSettings({ reminderAnchor: a })}
          options={[
            { value: 'start', label: 'From the start' },
            { value: 'end', label: 'From the end' },
          ]}
        />
        <Stepper
          theme={theme}
          size="small"
          label="Every"
          valueText={fmtInterval(settings.reminderIntervalMin)}
          onStep={(d) =>
            updateSettings({ reminderIntervalMin: Math.min(720, Math.max(30, settings.reminderIntervalMin + d * 15)) })
          }
        />
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Counting {fmtInterval(settings.reminderIntervalMin)} from the {settings.reminderAnchor} of your last session: a
          session from 9:00 to 9:20 AM means a reminder at {exNext ? fmtTime(exNext) : ''}.
        </Text>
      </Card>

      <SectionTitle theme={theme}>Baby's daily amount (optional)</SectionTitle>
      <Card theme={theme} style={{ gap: 12 }}>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Just a number you choose, used to show how many days your stash covers.
        </Text>
        {settings.babyNeedMl == null ? (
          <PillButton
            theme={theme}
            kind="ghost"
            label="Add a daily amount"
            onPress={() => updateSettings({ babyNeedMl: fromUnit(unit === 'oz' ? 25 : 750, unit) })}
          />
        ) : (
          <>
            <Stepper
              theme={theme}
              size="small"
              label="A day"
              valueText={volNumber(settings.babyNeedMl, unit)}
              unit={unitLabel(unit)}
              onStep={(d) => updateSettings({ babyNeedMl: stepBig(settings.babyNeedMl ?? 0, d, unit, bigStep(unit)) })}
              onTyped={(t) => {
                const v = parseVolume(t, unit);
                if (v != null && v > 0) updateSettings({ babyNeedMl: v });
              }}
            />
            <Pressable onPress={() => updateSettings({ babyNeedMl: null })} hitSlop={8} style={styles.clear}>
              <Text style={[styles.clearText, { color: theme.textFaint }]}>Clear</Text>
            </Pressable>
          </>
        )}
      </Card>

      <SectionTitle theme={theme}>Storage times</SectionTitle>
      <Card theme={theme} style={{ gap: 16 }}>
        <Stepper
          theme={theme}
          size="small"
          label="Fridge"
          valueText={String(settings.fridgeDays)}
          unit={settings.fridgeDays === 1 ? 'day' : 'days'}
          onStep={(d) => updateSettings({ fridgeDays: Math.min(8, Math.max(1, settings.fridgeDays + d)) })}
        />
        <Stepper
          theme={theme}
          size="small"
          label="Freezer"
          valueText={String(settings.freezerMonths)}
          unit={settings.freezerMonths === 1 ? 'month' : 'months'}
          onStep={(d) => updateSettings({ freezerMonths: Math.min(12, Math.max(1, settings.freezerMonths + d)) })}
        />
        <Stepper
          theme={theme}
          size="small"
          label="Deep freezer"
          valueText={String(settings.deepFreezerMonths)}
          unit={settings.deepFreezerMonths === 1 ? 'month' : 'months'}
          onStep={(d) => updateSettings({ deepFreezerMonths: Math.min(24, Math.max(1, settings.deepFreezerMonths + d)) })}
        />
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Starts at 4 days, 6 months and 12 months. Thawed milk is counted as good for 1 day.
        </Text>
        <Pressable onPress={() => Linking.openURL(CDC_STORAGE_URL)} hitSlop={8}>
          <Text style={[styles.link, { color: theme.accent }]}>CDC breast milk storage guidance</Text>
        </Pressable>
        <Text style={[styles.note, { color: theme.textFaint }]}>This is general guidance, not medical advice.</Text>
        {(settings.fridgeDays !== DEFAULT_STORAGE.fridgeDays ||
          settings.freezerMonths !== DEFAULT_STORAGE.freezerMonths ||
          settings.deepFreezerMonths !== DEFAULT_STORAGE.deepFreezerMonths) && (
          <Pressable onPress={() => updateSettings({ ...DEFAULT_STORAGE })} hitSlop={8}>
            <Text style={[styles.link, { color: theme.textSecondary }]}>Back to the starting times</Text>
          </Pressable>
        )}
      </Card>

      <SectionTitle theme={theme}>Your data</SectionTitle>
      <Card theme={theme}>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Works offline. Everything you log is saved on this iPhone. Pro can export a copy from Trends whenever you like.
        </Text>
      </Card>

      <SectionTitle theme={theme}>Purchases and help</SectionTitle>
      <Card theme={theme} style={{ paddingVertical: 6 }}>
        <Row theme={theme} label={busy ? 'Restoring' : 'Restore purchases'} onPress={busy ? undefined : onRestore} />
        <Row theme={theme} label="Terms of Use (EULA)" onPress={() => Linking.openURL(TERMS_URL)} />
        <Row theme={theme} label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Row theme={theme} label="Help and support" onPress={() => Linking.openURL(SUPPORT_URL)} />
      </Card>

      <SectionTitle theme={theme}>Start over</SectionTitle>
      <Card theme={theme} style={{ paddingVertical: 6 }}>
        <Row theme={theme} label="Delete all sessions and bags" danger onPress={onDeleteAll} />
      </Card>

      <Text style={[styles.version, { color: theme.textFaint }]}>
        Pumping v{Constants.expoConfig?.version ?? ''} · Made with care in NYC
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, marginTop: 8, marginBottom: 4 },
  upsell: { marginTop: 12, borderWidth: 0 },
  upsellTitle: { fontSize: 20, fontFamily: fonts.heading, marginBottom: 4 },
  upsellSub: { fontSize: 15, lineHeight: 21 },
  note: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 15, fontWeight: fonts.weight.semibold },
  clear: { alignSelf: 'center', minHeight: 40, justifyContent: 'center' },
  clearText: { fontSize: 15, fontWeight: fonts.weight.semibold },
  version: { textAlign: 'center', marginTop: 28, fontSize: 12 },
});
