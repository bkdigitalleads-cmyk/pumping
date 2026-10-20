import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, Theme } from '../theme';
import { PillButton, Segmented, StepButton, Stepper } from '../components';
import Icon, { IconName } from '../icons';
import { useApp } from '../state';
import { deleteBag, getAllBags, insertBag, markBagDiscarded, markBagUsed, moveBag, updateBag } from '../db';
import {
  addDays,
  Bag,
  BagLocation,
  bagStatus,
  fmtDate,
  fmtRelDay,
  fmtVol,
  fromUnit,
  isThawed,
  LOCATION_LABEL,
  LOCATIONS,
  nextLabelNo,
  parseVolume,
  stepVolume,
  todayIso,
  unitLabel,
  useBy,
  volNumber,
} from '../logic';

export const LOCATION_ICON: Record<BagLocation, IconName> = {
  fridge: 'fridge',
  freezer: 'snowflake',
  deep_freezer: 'chest',
};

/** The paper-tag card: what to write on the bag with a marker. */
export function LabelCard({ bag }: { bag: Bag }) {
  const theme = useTheme();
  const { settings } = useApp();
  return (
    <View style={[styles.label, { borderColor: theme.textFaint, backgroundColor: theme.card }]}>
      <Text style={[styles.labelHint, { color: theme.textSecondary }]}>Write this on the bag</Text>
      <Text style={[styles.labelNo, { color: theme.text }]}>#{bag.labelNo}</Text>
      <View style={styles.labelGrid}>
        <LabelLine theme={theme} k="Pumped" v={fmtDate(bag.pumpedOn)} />
        <LabelLine theme={theme} k="Amount" v={fmtVol(bag.volumeMl, settings.unit)} />
        <LabelLine theme={theme} k="Use by" v={fmtDate(useBy(bag, settings))} strong />
      </View>
    </View>
  );
}

function LabelLine({ theme, k, v, strong = false }: { theme: Theme; k: string; v: string; strong?: boolean }) {
  return (
    <View style={styles.labelLine}>
      <Text style={[styles.labelK, { color: theme.textFaint }]}>{k}</Text>
      <Text style={[styles.labelV, { color: strong ? theme.accent : theme.text }]}>{v}</Text>
    </View>
  );
}

/** Add a bag (bagId null) or correct one. After adding, shows the label card. */
export function BagForm({ visible, bagId, onClose }: { visible: boolean; bagId: number | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, bumpData } = useApp();
  const unit = settings.unit;
  const [labelNo, setLabelNo] = useState(1);
  const [pumpedOn, setPumpedOn] = useState(todayIso());
  const [volumeMl, setVolumeMl] = useState(fromUnit(unit === 'oz' ? 4 : 120, unit));
  const [location, setLocation] = useState<BagLocation>('freezer');
  const [saved, setSaved] = useState<Bag | null>(null);
  const editing = bagId != null;

  useEffect(() => {
    if (!visible) return;
    setSaved(null);
    (async () => {
      const all = await getAllBags();
      const b = bagId != null ? all.find((x) => x.id === bagId) : null;
      if (b) {
        setLabelNo(b.labelNo);
        setPumpedOn(b.pumpedOn);
        setVolumeMl(b.volumeMl);
        setLocation(b.location);
      } else {
        setLabelNo(nextLabelNo(all));
        setPumpedOn(todayIso());
        setVolumeMl(fromUnit(unit === 'oz' ? 4 : 120, unit));
        setLocation('freezer');
      }
    })();
  }, [visible, bagId, unit]);

  const save = async () => {
    if (volumeMl <= 0) {
      Alert.alert('How much is in the bag?', 'Add the amount, then save.');
      return;
    }
    try {
      const input = { labelNo, pumpedOn, volumeMl, location };
      if (editing) {
        await updateBag(bagId, input);
        bumpData();
        onClose();
        return;
      }
      const id = await insertBag(input);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bumpData();
      setSaved({ id, ...input, movedAt: null, usedAt: null, discardedAt: null });
    } catch (e: any) {
      Alert.alert('Couldn’t save the bag', e?.message ?? 'Please try again.');
    }
  };

  const today = todayIso();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: theme.textSecondary }]}>{saved ? 'Close' : 'Cancel'}</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{saved ? 'Bag saved' : editing ? 'Edit bag' : 'Add a bag'}</Text>
          {saved ? (
            <View style={{ width: 50 }} />
          ) : (
            <Pressable onPress={save} hitSlop={12}>
              <Text style={[styles.headerBtn, { color: theme.accent, fontWeight: fonts.weight.bold }]}>Save</Text>
            </Pressable>
          )}
        </View>
        {saved ? (
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
            <LabelCard bag={saved} />
            <Text style={[styles.savedNote, { color: theme.textSecondary }]}>
              It is in your stash now, lined up by its use-by date.
            </Text>
            <View style={{ marginTop: 20 }}>
              <PillButton theme={theme} big label="Done" onPress={onClose} />
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Stepper
                theme={theme}
                label="Amount"
                valueText={volNumber(volumeMl, unit)}
                unit={unitLabel(unit)}
                onStep={(d) => setVolumeMl((v) => stepVolume(v, d, unit))}
                onTyped={(t) => {
                  const v = parseVolume(t, unit);
                  if (v != null) setVolumeMl(v);
                }}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Where it goes</Text>
            <Segmented
              theme={theme}
              value={location}
              onChange={setLocation}
              options={LOCATIONS.map((l) => ({ value: l, label: LOCATION_LABEL[l] }))}
            />

            <View style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 16 }]}>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Pumped</Text>
                <StepButton theme={theme} dir={-1} size={48} label="Day before" onStep={() => setPumpedOn((d) => addDays(d, -1))} />
                <Text style={[styles.rowValue, { color: theme.text }]}>{fmtRelDay(pumpedOn, today)}</Text>
                <StepButton
                  theme={theme}
                  dir={1}
                  size={48}
                  label="Day after"
                  disabled={pumpedOn >= today}
                  onStep={() => setPumpedOn((d) => (d < todayIso() ? addDays(d, 1) : d))}
                />
              </View>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Bag no.</Text>
                <StepButton theme={theme} dir={-1} size={48} label="Lower bag number" onStep={() => setLabelNo((n) => Math.max(1, n - 1))} />
                <Text style={[styles.rowValue, { color: theme.text }]}>#{labelNo}</Text>
                <StepButton theme={theme} dir={1} size={48} label="Higher bag number" onStep={() => setLabelNo((n) => n + 1)} />
              </View>
            </View>
            <Text style={[styles.hint, { color: theme.textFaint }]}>
              Use by {fmtDate(useBy({ id: 0, labelNo, pumpedOn, volumeMl, location, movedAt: null, usedAt: null, discardedAt: null }, settings))}, from your storage times in Settings.
            </Text>
            <View style={{ marginTop: 22 }}>
              <PillButton theme={theme} big label={editing ? 'Save changes' : 'Save bag'} onPress={save} />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/**
 * Everything you can do with one bag: use it, move it, discard it, see its label.
 * onDone reports what happened so the stash can offer Undo.
 */
export function BagSheet({
  bag,
  onClose,
  onEdit,
  onDone,
}: {
  bag: Bag | null;
  onClose: () => void;
  onEdit: (id: number) => void;
  onDone: (bag: Bag, what: 'used' | 'discarded') => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, bumpData } = useApp();
  if (!bag) return null;
  const thawed = isThawed(bag);
  const expired = bagStatus(bag, settings, todayIso()) === 'expired';

  const act = async (fn: () => Promise<void>, what?: 'used' | 'discarded') => {
    await fn();
    Haptics.selectionAsync().catch(() => {});
    bumpData();
    onClose();
    if (what) onDone(bag, what);
  };

  // Thawed milk does not go back in a freezer.
  const moves = LOCATIONS.filter((l) => l !== bag.location && !(thawed && l !== 'fridge'));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={{ width: 50 }} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>Bag #{bag.labelNo}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: theme.accent, fontWeight: fonts.weight.bold }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
          <LabelCard bag={bag} />
          <Text style={[styles.savedNote, { color: theme.textSecondary }]}>
            {LOCATION_LABEL[bag.location]}
            {thawed ? ', thawing. Thawed milk is best used within 24 hours and not refrozen.' : '.'}
            {expired ? ' This bag is past its use-by date.' : ''}
          </Text>
          <View style={{ gap: 12, marginTop: 20 }}>
            {!expired && <PillButton theme={theme} big icon="check" label="Used it" onPress={() => act(() => markBagUsed(bag.id), 'used')} />}
            {moves.map((l) => (
              <PillButton
                key={l}
                theme={theme}
                kind="ghost"
                icon={LOCATION_ICON[l]}
                label={l === 'fridge' && bag.location !== 'fridge' ? 'Move to the fridge to thaw' : `Move to the ${LOCATION_LABEL[l].toLowerCase()}`}
                onPress={() => act(() => moveBag(bag.id, l))}
              />
            ))}
            <PillButton
              theme={theme}
              kind={expired ? 'primary' : 'ghost'}
              icon="trash"
              label="Discard"
              onPress={() => act(() => markBagDiscarded(bag.id), 'discarded')}
            />
          </View>
          <View style={styles.smallActions}>
            <Pressable onPress={() => onEdit(bag.id)} hitSlop={10} style={styles.smallBtn}>
              <Icon name="pencil" size={16} color={theme.textSecondary} />
              <Text style={[styles.smallText, { color: theme.textSecondary }]}>Fix a typo</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert('Delete this bag?', 'Only for a bag added by mistake. To use or toss it, choose Used it or Discard.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => act(() => deleteBag(bag.id)) },
                ])
              }
              hitSlop={10}
              style={styles.smallBtn}
            >
              <Text style={[styles.smallText, { color: theme.danger }]}>Added by mistake</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 17 },
  headerTitle: { fontSize: 18, fontFamily: fonts.heading },
  scroll: { padding: 20 },
  box: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 16, paddingHorizontal: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  rowLabel: { fontSize: 15, fontWeight: '600', width: 64 },
  rowValue: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 22 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  hint: { fontSize: 13, marginTop: 10, marginLeft: 4, lineHeight: 18 },
  label: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 20, padding: 22, alignItems: 'center' },
  labelHint: { fontFamily: fonts.soft, fontSize: 16 },
  labelNo: { fontFamily: fonts.display, fontSize: 72, lineHeight: 82, marginTop: 4 },
  labelGrid: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  labelLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  labelK: { fontSize: 14, fontWeight: '600', letterSpacing: 0.4 },
  labelV: { fontFamily: fonts.display, fontSize: 22 },
  savedNote: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 14 },
  smallActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  smallText: { fontSize: 15, fontWeight: '600' },
});
