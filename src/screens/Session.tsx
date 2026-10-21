import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts, Theme } from '../theme';
import { useApp } from '../state';
import { countSessions, deleteSession, getSession, getSessionsBetween, insertSession, updateSession } from '../db';
import {
  addDays,
  fmtClock,
  fmtDuration,
  fmtHm,
  fmtRelDay,
  fmtTime,
  fmtVol,
  isoFromMs,
  parseVolume,
  startOfDayMs,
  stepVolume,
  todayIso,
  ML_PER_OZ,
  Unit,
  unitLabel,
  volNumber,
  volumeStep,
} from '../logic';
import { maybeRequestReviewAfterSession } from '../reviews';
import Figures from '../ui/Figures';
import ThumbBar from '../ui/ThumbBar';
import { Entry, Nudge, Section, Tabs } from '../ui/List';
import { PillAction, Press, RoundButton, SheetHeader, TextAction } from '../ui/Press';
import { success, useRepeat } from '../ui/motion';
import Icon from '../icons';

/**
 *  live  - the running timer (its start time is saved, so it survives app
 *          switching and relaunch) with left and right halves to tap
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

/** "Logged. 4½ oz, left side did more today." */
async function savedLine(sessionMl: number, unit: Unit): Promise<string> {
  if (sessionMl <= 0) return 'Logged. Add the ounces once you have measured.';
  const day = todayIso();
  const list = await getSessionsBetween(startOfDayMs(day), startOfDayMs(addDays(day, 1)));
  const l = list.reduce((s, x) => s + x.leftMl, 0);
  const r = list.reduce((s, x) => s + x.rightMl, 0);
  const even = Math.abs(l - r) < ML_PER_OZ / 4;
  const sides = even ? 'both sides about even today' : `${l > r ? 'left' : 'right'} side did more today`;
  return `Logged. ${fmtVol(sessionMl, unit)}, ${sides}.`;
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
        {visible && view !== 'live' && <PastForm mode={view} sessionId={sessionId} onClose={onClose} />}
      </View>
    </Modal>
  );
}

function Live({ onClose, onFix }: { onClose: () => void; onFix: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { active, updateActive, clearActive, settings, bumpData, say } = useApp();
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const unit = settings.unit;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedSec = active ? Math.max(0, (now - active.startedAt) / 1000) : 0;

  if (!active) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[styles.quiet, { color: theme.inkSoft }]}>The timer is not running.</Text>
        <TextAction theme={theme} label="Close" onPress={onClose} align="center" />
      </View>
    );
  }

  const totalMl = active.leftMl + active.rightMl;

  const finish = async () => {
    if (saving) return;
    const endedAt = Date.now();
    if ((endedAt - active.startedAt) / MIN > LONG_SESSION_MIN) {
      const asIs = await confirm(
        `Still going after ${fmtDuration((endedAt - active.startedAt) / 1000)}?`,
        'If the timer kept running after you were done, fix the times first.',
        'Save as is',
        'Fix the times'
      );
      if (!asIs) return onFix();
    }
    if (totalMl === 0) {
      const ok = await confirm('Save it without amounts?', 'You can add the ounces later.', 'Save', 'Add amounts');
      if (!ok) return;
    }
    setSaving(true);
    try {
      await insertSession({ ...active, endedAt });
      await clearActive();
      success();
      bumpData();
      onClose();
      say(await savedLine(totalMl, unit));
      maybeRequestReviewAfterSession(await countSessions());
    } catch (e: any) {
      Alert.alert('That did not save', e?.message ?? 'Try once more.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () =>
    Alert.alert('Toss this session?', 'The timer stops and nothing is saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Toss it',
        style: 'destructive',
        onPress: async () => {
          await clearActive();
          onClose();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.liveTop, { paddingTop: insets.top + 6 }]}>
        <Press onPress={onClose} hitSlop={12} style={styles.hide} accessibilityRole="button" accessibilityLabel="Hide. The timer keeps running.">
          <Icon name="chevronDown" size={24} color={theme.inkSoft} />
          <Text style={[styles.hideText, { color: theme.inkSoft }]}>Hide</Text>
        </Press>
        <TextAction theme={theme} label={noteOpen ? 'Done' : active.note ? 'Note' : 'Add a note'} onPress={() => setNoteOpen((v) => !v)} />
      </View>

      <View style={styles.timerWrap}>
        <Figures value={fmtClock(elapsedSec)} size={92} color={theme.ink} maxScale={1.15} label={`Pumping for ${fmtDuration(elapsedSec)}`} />
        <Text style={[styles.started, { color: theme.inkSoft }]}>
          Started {fmtHm(active.startedAt)}. It keeps time with the phone locked.
        </Text>
        {noteOpen && (
          <TextInput
            autoFocus
            style={[styles.note, { color: theme.ink, borderBottomColor: theme.rule }]}
            value={active.note}
            onChangeText={(note) => updateActive({ note })}
            placeholder="Flange size, slow letdown, power pumping"
            placeholderTextColor={theme.inkFaint}
            multiline
            accessibilityLabel="Note"
          />
        )}
      </View>

      <View style={[styles.halves, { borderTopColor: theme.rule }]}>
        <SideHalf
          theme={theme}
          side="Left"
          color={theme.left}
          ml={active.leftMl}
          unit={unit}
          onStep={(d) => updateActive({ leftMl: stepVolume(active.leftMl, d, unit) })}
        />
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: theme.rule }} />
        <SideHalf
          theme={theme}
          side="Right"
          color={theme.right}
          ml={active.rightMl}
          unit={unit}
          onStep={(d) => updateActive({ rightMl: stepVolume(active.rightMl, d, unit) })}
        />
      </View>

      <View style={{ paddingBottom: insets.bottom }}>
        <ThumbBar theme={theme}>
          <Press onPress={discard} hitSlop={8} style={styles.toss} accessibilityRole="button" accessibilityLabel="Toss this session">
            <Text style={[styles.tossText, { color: theme.inkSoft }]}>Toss</Text>
          </Press>
          <View style={{ flex: 1 }}>
            <PillAction
              theme={theme}
              tall
              label={saving ? 'Saving' : totalMl > 0 ? `Done, save ${fmtVol(totalMl, unit)}` : 'Done, save it'}
              onPress={finish}
              disabled={saving}
            />
          </View>
        </ThumbBar>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Half the screen for one side: tap anywhere to add a step, hold to keep adding faster. */
function SideHalf({
  theme,
  side,
  color,
  ml,
  unit,
  onStep,
}: {
  theme: Theme;
  side: string;
  color: string;
  ml: number;
  unit: Unit;
  onStep: (dir: 1 | -1) => void;
}) {
  const add = useRepeat(() => onStep(1));
  const sub = useRepeat(() => onStep(-1));
  const step = unit === 'oz' ? '½ oz' : `${volumeStep(unit)} mL`;
  return (
    <Press
      {...add}
      style={styles.half}
      pressedStyle={{ backgroundColor: theme.sunk }}
      accessibilityRole="adjustable"
      accessibilityLabel={`${side}, ${fmtVol(ml, unit)}`}
      accessibilityHint={`Tap to add ${step}. Hold to keep adding.`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <View style={styles.halfTop}>
        <Text style={[styles.side, { color }]}>{side}</Text>
        <RoundButton theme={theme} icon="minus" label={`Take ${step} off ${side.toLowerCase()}`} onPress={() => onStep(-1)} repeat={sub} disabled={ml <= 0} />
      </View>
      <View style={styles.halfMid}>
        <Figures value={volNumber(ml, unit)} size={64} color={ml > 0 ? theme.ink : theme.inkFaint} maxScale={1.2} />
        <Text style={[styles.unit, { color: theme.inkFaint }]}>{unitLabel(unit)}</Text>
      </View>
      <Text style={[styles.tapHint, { color: theme.inkFaint }]}>tap for +{step}</Text>
    </Press>
  );
}

function PastForm({ mode, sessionId, onClose }: { mode: 'past' | 'edit' | 'fix'; sessionId: number | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, bumpData, active, clearActive, say } = useApp();
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

  const upd = (fn: (f: Form) => Form) => setForm((f) => (f ? fn(f) : f));
  const today = todayIso();
  const day = isoFromMs(form.startedAt);
  const endedAt = form.startedAt + form.durationMin * MIN;
  const title = mode === 'edit' ? 'Edit session' : mode === 'fix' ? 'Fix the times' : 'Past session';
  const lengths = ['10', '15', '20', '30'] as const;

  const shiftDay = (n: number) =>
    upd((f) => {
      const d = isoFromMs(f.startedAt);
      const next = addDays(d, n);
      if (next > todayIso()) return f;
      return { ...f, startedAt: startOfDayMs(next) + (f.startedAt - startOfDayMs(d)) };
    });

  const save = async () => {
    if (endedAt > Date.now() + MIN) {
      Alert.alert('That ends in the future', 'Move the start earlier or make it shorter.');
      return;
    }
    if (form.leftMl + form.rightMl === 0) {
      const ok = await confirm('Save it without amounts?', 'You can add the ounces later.', 'Save', 'Add amounts');
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
      success();
      bumpData();
      onClose();
      say(mode === 'edit' ? 'Saved.' : await savedLine(form.leftMl + form.rightMl, unit));
      if (mode !== 'edit') maybeRequestReviewAfterSession(await countSessions());
    } catch (e: any) {
      Alert.alert('That did not save', e?.message ?? 'Try once more.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (sessionId == null) return;
    Alert.alert('Delete this session?', 'It comes off your totals for good.', [
      { text: 'Keep it', style: 'cancel' },
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

  const volNudge = (key: 'leftMl' | 'rightMl', label: string) => (
    <Nudge
      theme={theme}
      label={label}
      value={volNumber(form[key], unit)}
      unit={unitLabel(unit)}
      onStep={(d) => upd((f) => ({ ...f, [key]: stepVolume(f[key], d, unit) }))}
      onTyped={(t) => {
        const v = parseVolume(t, unit);
        if (v != null) upd((f) => ({ ...f, [key]: v }));
      }}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader theme={theme} title={title} top={insets.top} left={{ label: 'Cancel', onPress: onClose }} right={{ label: 'Save', onPress: save, strong: true }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Section theme={theme} title="When" first>
          <Nudge theme={theme} label="Day" value={fmtRelDay(day, today)} onStep={(d) => shiftDay(d)} />
          <Nudge
            theme={theme}
            label="Started"
            value={fmtHm(form.startedAt)}
            unit={fmtTime(form.startedAt).slice(-2)}
            onStep={(d) => upd((f) => ({ ...f, startedAt: f.startedAt + d * 5 * MIN }))}
          />
          <Nudge
            theme={theme}
            label="Length"
            value={String(form.durationMin)}
            unit="min"
            onStep={(d) => upd((f) => ({ ...f, durationMin: Math.min(240, Math.max(1, f.durationMin + d)) }))}
          />
          <View style={{ paddingVertical: 8 }}>
            <Tabs
              theme={theme}
              gap={16}
              value={(lengths as readonly string[]).includes(String(form.durationMin)) ? (String(form.durationMin) as (typeof lengths)[number]) : ('' as any)}
              onChange={(v) => upd((f) => ({ ...f, durationMin: Number(v) }))}
              options={lengths.map((l) => ({ value: l, label: `${l} min` }))}
            />
          </View>
          {mode === 'past' && (
            <View style={[styles.quick, { borderBottomColor: theme.rule }]}>
              <Text style={[styles.quickLabel, { color: theme.inkSoft }]}>Started about</Text>
              {[1, 2, 3].map((h) => (
                <TextAction
                  key={h}
                  theme={theme}
                  label={`${h} h ago`}
                  onPress={() => upd((f) => ({ ...f, startedAt: Math.floor((Date.now() - h * 60 * MIN) / (5 * MIN)) * 5 * MIN }))}
                />
              ))}
            </View>
          )}
        </Section>

        <Section theme={theme} title="How much" note={`Total ${fmtVol(form.leftMl + form.rightMl, unit)}`}>
          {volNudge('leftMl', 'Left')}
          {volNudge('rightMl', 'Right')}
        </Section>

        <Section theme={theme} title="Note">
          <TextInput
            style={[styles.formNote, { color: theme.ink, borderBottomColor: theme.rule }]}
            value={form.note}
            onChangeText={(note) => upd((f) => ({ ...f, note }))}
            placeholder="Flange size, slow letdown, power pumping"
            placeholderTextColor={theme.inkFaint}
            multiline
            accessibilityLabel="Note"
          />
        </Section>

        {mode === 'edit' && (
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <TextAction theme={theme} label="Delete this session" onPress={remove} color={theme.danger} />
          </View>
        )}
      </ScrollView>
      <View style={{ paddingBottom: insets.bottom }}>
        <ThumbBar theme={theme}>
          <View style={{ flex: 1 }}>
            <PillAction theme={theme} tall label={saving ? 'Saving' : 'Save session'} onPress={save} disabled={saving} />
          </View>
        </ThumbBar>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  quiet: { fontSize: 17 },
  liveTop: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hide: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 12 },
  hideText: { fontSize: 16, fontWeight: '600' },
  timerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  started: { fontFamily: fonts.soft, fontSize: 17, textAlign: 'center', marginTop: 6, lineHeight: 23 },
  note: { alignSelf: 'stretch', fontSize: 17, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingVertical: 8 },
  halves: { flexDirection: 'row', minHeight: 300, borderTopWidth: StyleSheet.hairlineWidth },
  half: { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, justifyContent: 'space-between' },
  halfTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { fontFamily: fonts.heading, fontSize: 24 },
  halfMid: { alignItems: 'center' },
  unit: { fontSize: 15, fontWeight: '600', marginTop: -6 },
  tapHint: { fontSize: 14, textAlign: 'center' },
  toss: { minHeight: 60, minWidth: 60, justifyContent: 'center', alignItems: 'center' },
  tossText: { fontSize: 16, fontWeight: '600' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18, paddingHorizontal: 20, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  quickLabel: { fontSize: 15 },
  formNote: { fontSize: 17, minHeight: 64, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
