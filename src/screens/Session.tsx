import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, Theme } from '../theme';
import { PillButton, StepButton, Stepper } from '../components';
import Icon from '../icons';
import { useApp } from '../state';
import { countSessions, deleteSession, getSession, insertSession, updateSession } from '../db';
import {
  addDays,
  fmtClock,
  fmtDuration,
  fmtRelDay,
  fmtTime,
  fmtVol,
  isoFromMs,
  parseVolume,
  startOfDayMs,
  stepVolume,
  todayIso,
  unitLabel,
  volNumber,
} from '../logic';
import { maybeRequestReviewAfterSession } from '../reviews';

/**
 *  live  - the running timer (its start time is saved, so it survives app
 *          switching and relaunch) with left and right steppers
 *  past  - log a session that already happened: day, start time, length
 *  edit  - the same form for a saved session, with delete
 */
export type SessionMode = 'live' | 'past' | 'edit';

/** A timer left running longer than this asks whether it was forgotten. */
const LONG_SESSION_MIN = 120;
const MIN = 60_000;

interface Form {
  startedAt: number;
  durationMin: number;
  leftMl: number;
  rightMl: number;
  note: string;
}

function confirm(title: string, message: string, ok: string, cancel: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ])
  );
}

export default function SessionModal({
  visible,
  mode,
  sessionId,
  onClose,
}: {
  visible: boolean;
  mode: SessionMode;
  sessionId: number | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  // "Fix the times" turns a forgotten live timer into the past-session form.
  const [fixing, setFixing] = useState(false);
  useEffect(() => {
    if (visible) setFixing(false);
  }, [visible]);

  const view = mode === 'live' && !fixing ? 'live' : mode === 'live' ? 'fix' : mode;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {visible && view === 'live' && <Live onClose={onClose} onFix={() => setFixing(true)} />}
        {visible && view !== 'live' && (
          <PastForm mode={view} sessionId={sessionId} onClose={onClose} />
        )}
      </View>
    </Modal>
  );
}

function Live({ onClose, onFix }: { onClose: () => void; onFix: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { active, updateActive, clearActive, settings, bumpData } = useApp();
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const unit = settings.unit;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!active) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[styles.body, { color: theme.textSecondary }]}>No session running.</Text>
        <View style={{ marginTop: 16 }}>
          <PillButton theme={theme} label="Close" kind="ghost" onPress={onClose} />
        </View>
      </View>
    );
  }

  const elapsedSec = Math.max(0, (now - active.startedAt) / 1000);
  const totalMl = active.leftMl + active.rightMl;

  const finish = async () => {
    if (saving) return;
    const endedAt = Date.now();
    if ((endedAt - active.startedAt) / MIN > LONG_SESSION_MIN) {
      const asIs = await confirm(
        'That was a long one',
        `The timer has been running for ${fmtDuration((endedAt - active.startedAt) / 1000)}. If it kept going after you finished, fix the times first.`,
        'Save as is',
        'Fix the times'
      );
      if (!asIs) return onFix();
    }
    if (totalMl === 0) {
      const ok = await confirm('No amounts yet', 'Save this session without amounts? You can add them later.', 'Save', 'Add amounts');
      if (!ok) return;
    }
    setSaving(true);
    try {
      await insertSession({ ...active, endedAt });
      await clearActive();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bumpData();
      onClose();
      maybeRequestReviewAfterSession(await countSessions());
    } catch (e: any) {
      Alert.alert('Couldn’t save the session', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () =>
    Alert.alert('Discard this session?', 'The timer stops and nothing is saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await clearActive();
          onClose();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.liveHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} hitSlop={14} style={styles.hideBtn} accessibilityLabel="Hide, the timer keeps running">
          <Icon name="chevronDown" size={26} color={theme.textSecondary} />
          <Text style={[styles.hideText, { color: theme.textSecondary }]}>Hide</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.liveScroll, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.timer, { color: theme.text }]} accessibilityLabel={`Pumping for ${fmtDuration(elapsedSec)}`}>
          {fmtClock(elapsedSec)}
        </Text>
        <Text style={[styles.started, { color: theme.textSecondary }]}>
          Started {fmtTime(active.startedAt)}. The timer keeps going if you leave the app.
        </Text>

        <View style={[styles.sides, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Stepper
            theme={theme}
            label="Left"
            color={theme.left}
            valueText={volNumber(active.leftMl, unit)}
            unit={unitLabel(unit)}
            onStep={(d) => updateActive({ leftMl: stepVolume(active.leftMl, d, unit) })}
            onTyped={(t) => {
              const v = parseVolume(t, unit);
              if (v != null) updateActive({ leftMl: v });
            }}
          />
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <Stepper
            theme={theme}
            label="Right"
            color={theme.right}
            valueText={volNumber(active.rightMl, unit)}
            unit={unitLabel(unit)}
            onStep={(d) => updateActive({ rightMl: stepVolume(active.rightMl, d, unit) })}
            onTyped={(t) => {
              const v = parseVolume(t, unit);
              if (v != null) updateActive({ rightMl: v });
            }}
          />
          <Text style={[styles.total, { color: theme.textSecondary }]}>
            Total <Text style={{ color: theme.text, fontFamily: fonts.display }}>{fmtVol(totalMl, unit)}</Text>
          </Text>
        </View>

        <TextInput
          style={[styles.note, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={active.note}
          onChangeText={(note) => updateActive({ note })}
          placeholder="Add a note (optional)"
          placeholderTextColor={theme.textFaint}
          multiline
        />

        <View style={{ marginTop: 22, gap: 14 }}>
          <PillButton theme={theme} big icon="check" label={saving ? 'Saving' : 'Finish and save'} onPress={finish} disabled={saving} />
          <Pressable onPress={discard} hitSlop={10} style={styles.linkBtn}>
            <Text style={[styles.link, { color: theme.textFaint }]}>Discard this session</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PastForm({ mode, sessionId, onClose }: { mode: 'past' | 'edit' | 'fix'; sessionId: number | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, bumpData, active, clearActive } = useApp();
  const unit = settings.unit;
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (mode === 'edit' && sessionId != null) {
        const s = await getSession(sessionId);
        if (s) {
          setForm({
            startedAt: s.startedAt,
            durationMin: Math.max(1, Math.round(s.durationSec / 60)),
            leftMl: s.leftMl,
            rightMl: s.rightMl,
            note: s.note,
          });
          return;
        }
      }
      if (mode === 'fix' && active) {
        setForm({ ...active, durationMin: 20 });
        return;
      }
      // A past session: by default it started an hour ago and lasted 20 minutes.
      const start = Math.floor((Date.now() - 60 * MIN) / (5 * MIN)) * 5 * MIN;
      setForm({ startedAt: start, durationMin: 20, leftMl: 0, rightMl: 0, note: '' });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!form) return <View style={{ flex: 1 }} />;

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const today = todayIso();
  const day = isoFromMs(form.startedAt);
  const endedAt = form.startedAt + form.durationMin * MIN;
  const title = mode === 'edit' ? 'Edit session' : mode === 'fix' ? 'Fix the times' : 'Log a past session';

  const shiftDay = (n: number) => {
    const next = addDays(day, n);
    if (next > today) return;
    const timeOfDay = form.startedAt - startOfDayMs(day);
    set({ startedAt: startOfDayMs(next) + timeOfDay });
  };

  const save = async () => {
    if (endedAt > Date.now() + MIN) {
      Alert.alert('That ends in the future', 'Move the start time earlier or make the session shorter.');
      return;
    }
    if (form.leftMl + form.rightMl === 0) {
      const ok = await confirm('No amounts yet', 'Save this session without amounts? You can add them later.', 'Save', 'Add amounts');
      if (!ok) return;
    }
    setSaving(true);
    try {
      const input = { startedAt: form.startedAt, endedAt, leftMl: form.leftMl, rightMl: form.rightMl, note: form.note };
      if (mode === 'edit' && sessionId != null) {
        await updateSession(sessionId, input);
      } else {
        await insertSession(input);
        if (mode === 'fix') await clearActive();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bumpData();
      onClose();
      if (mode !== 'edit') maybeRequestReviewAfterSession(await countSessions());
    } catch (e: any) {
      Alert.alert('Couldn’t save the session', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (sessionId == null) return;
    Alert.alert('Delete this session?', 'It comes off your totals. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(sessionId);
          bumpData();
          onClose();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={[styles.headerBtn, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
        <Pressable onPress={save} hitSlop={12} disabled={saving}>
          <Text style={[styles.headerBtn, { color: theme.accent, fontWeight: fonts.weight.bold }]}>Save</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        {mode === 'past' && (
          <View style={styles.chips}>
            {[1, 2, 3].map((h) => (
              <Chip
                key={h}
                theme={theme}
                label={`${h} hour${h === 1 ? '' : 's'} ago`}
                onPress={() => set({ startedAt: Math.floor((Date.now() - h * 60 * MIN) / (5 * MIN)) * 5 * MIN })}
              />
            ))}
          </View>
        )}

        <View style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TimeRow
            theme={theme}
            label="Day"
            value={fmtRelDay(day, today)}
            onMinus={() => shiftDay(-1)}
            onPlus={() => shiftDay(1)}
            plusDisabled={day >= today}
          />
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <TimeRow
            theme={theme}
            label="Started"
            value={fmtTime(form.startedAt)}
            onMinus={() => setForm((f) => (f ? { ...f, startedAt: f.startedAt - 5 * MIN } : f))}
            onPlus={() => setForm((f) => (f ? { ...f, startedAt: f.startedAt + 5 * MIN } : f))}
          />
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <TimeRow
            theme={theme}
            label="Length"
            value={`${form.durationMin} min`}
            onMinus={() => setForm((f) => (f ? { ...f, durationMin: Math.max(1, f.durationMin - 1) } : f))}
            onPlus={() => setForm((f) => (f ? { ...f, durationMin: Math.min(240, f.durationMin + 1) } : f))}
          />
          <View style={styles.chips}>
            {[10, 15, 20, 30].map((m) => (
              <Chip key={m} theme={theme} label={`${m} min`} on={form.durationMin === m} onPress={() => set({ durationMin: m })} />
            ))}
          </View>
        </View>

        <View style={[styles.sides, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Stepper
            theme={theme}
            label="Left"
            color={theme.left}
            valueText={volNumber(form.leftMl, unit)}
            unit={unitLabel(unit)}
            onStep={(d) => setForm((f) => (f ? { ...f, leftMl: stepVolume(f.leftMl, d, unit) } : f))}
            onTyped={(t) => {
              const v = parseVolume(t, unit);
              if (v != null) set({ leftMl: v });
            }}
          />
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <Stepper
            theme={theme}
            label="Right"
            color={theme.right}
            valueText={volNumber(form.rightMl, unit)}
            unit={unitLabel(unit)}
            onStep={(d) => setForm((f) => (f ? { ...f, rightMl: stepVolume(f.rightMl, d, unit) } : f))}
            onTyped={(t) => {
              const v = parseVolume(t, unit);
              if (v != null) set({ rightMl: v });
            }}
          />
          <Text style={[styles.total, { color: theme.textSecondary }]}>
            Total <Text style={{ color: theme.text, fontFamily: fonts.display }}>{fmtVol(form.leftMl + form.rightMl, unit)}</Text>
          </Text>
        </View>

        <TextInput
          style={[styles.note, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={form.note}
          onChangeText={(note) => set({ note })}
          placeholder="Add a note (optional)"
          placeholderTextColor={theme.textFaint}
          multiline
        />

        <View style={{ marginTop: 22, gap: 14 }}>
          <PillButton theme={theme} big label={saving ? 'Saving' : 'Save session'} onPress={save} disabled={saving} />
          {mode === 'edit' && (
            <Pressable onPress={remove} hitSlop={10} style={styles.linkBtn}>
              <Text style={[styles.link, { color: theme.danger }]}>Delete this session</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TimeRow({
  theme,
  label,
  value,
  onMinus,
  onPlus,
  plusDisabled = false,
}: {
  theme: Theme;
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  plusDisabled?: boolean;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>{label}</Text>
      <StepButton theme={theme} dir={-1} size={48} onStep={onMinus} label={`Earlier ${label.toLowerCase()}`} />
      <Text style={[styles.timeValue, { color: theme.text }]}>{value}</Text>
      <StepButton theme={theme} dir={1} size={48} onStep={onPlus} label={`Later ${label.toLowerCase()}`} disabled={plusDisabled} />
    </View>
  );
}

function Chip({ theme, label, onPress, on = false }: { theme: Theme; label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? theme.accent : theme.cardAlt }]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, { color: on ? theme.onAccent : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  body: { fontSize: 17 },
  liveHeader: { paddingHorizontal: 16, flexDirection: 'row' },
  hideBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 12 },
  hideText: { fontSize: 16, fontWeight: '600' },
  liveScroll: { paddingHorizontal: 22 },
  timer: { fontFamily: fonts.display, fontSize: 84, lineHeight: 96, textAlign: 'center', marginTop: 8, fontVariant: ['tabular-nums'] },
  started: { fontFamily: fonts.soft, fontSize: 16, textAlign: 'center', marginTop: 2, lineHeight: 22, paddingHorizontal: 20 },
  sides: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 20, marginTop: 24, gap: 14, alignItems: 'center' },
  rule: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 20 },
  total: { fontSize: 15, marginTop: 2 },
  note: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, fontSize: 16, minHeight: 56, marginTop: 14 },
  linkBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 17 },
  headerTitle: { fontSize: 18, fontFamily: fonts.heading },
  formScroll: { padding: 20 },
  box: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 16, gap: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  timeLabel: { fontSize: 15, fontWeight: '600', width: 64 },
  timeValue: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  chip: { borderRadius: 18, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
});
