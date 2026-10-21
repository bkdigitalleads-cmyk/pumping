import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../theme';
import { useApp } from '../state';
import { deleteBag, getAllBags, insertBag, markBagDiscarded, markBagUsed, moveBag, updateBag } from '../db';
import {
  addDays,
  Bag,
  BagLocation,
  bagStatus,
  fmtDate,
  fmtRelDay,
  fmtShortDate,
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
import { IconName } from '../icons';
import BagDrawing, { BAG_CAPACITY_ML } from '../ui/BagDrawing';
import Tape, { Marker } from '../ui/Tape';
import ThumbBar from '../ui/ThumbBar';
import { Entry, Nudge, Section, Tabs } from '../ui/List';
import { PillAction, SheetHeader } from '../ui/Press';
import { success, tick } from '../ui/motion';

export const LOCATION_ICON: Record<BagLocation, IconName> = {
  fridge: 'fridge',
  freezer: 'snowflake',
  deep_freezer: 'chest',
};

/** The label, as a strip of masking tape with what to write on the bag. */
export function LabelTape({ bag }: { bag: Bag }) {
  const theme = useTheme();
  const { settings } = useApp();
  const u = settings.unit;
  return (
    <View style={styles.labelWrap} accessible accessibilityLabel={`Write on the bag: number ${bag.labelNo}, pumped ${fmtDate(bag.pumpedOn)}, ${fmtVol(bag.volumeMl, u)}, use by ${fmtDate(useBy(bag, settings))}`}>
      <Text style={[styles.labelHint, { color: theme.inkSoft }]}>Write this on the bag</Text>
      <Tape theme={theme} rotate={-2} seed={bag.labelNo} style={{ alignSelf: 'stretch' }}>
        <View style={styles.labelRow}>
          <Marker theme={theme} size={46}>#{bag.labelNo}</Marker>
          <View style={{ alignItems: 'flex-end' }}>
            <Marker theme={theme} size={30}>{fmtShortDate(bag.pumpedOn)}</Marker>
            <Marker theme={theme} size={30}>{fmtVol(bag.volumeMl, u)}</Marker>
          </View>
        </View>
        <Marker theme={theme} size={24} color={theme.accent}>use by {fmtShortDate(useBy(bag, settings))}</Marker>
      </Tape>
    </View>
  );
}

/** Add a bag (bagId null) or correct one. After adding, shows the tape to copy onto the bag. */
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

  const draft: Bag = { id: 0, labelNo, pumpedOn, volumeMl, location, movedAt: null, usedAt: null, discardedAt: null };

  const save = async () => {
    if (volumeMl <= 0) {
      Alert.alert('How much is in it?', 'Put the amount in, then save.');
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
      success();
      bumpData();
      setSaved({ ...draft, id });
    } catch (e: any) {
      Alert.alert('That did not save', e?.message ?? 'Try once more.');
    }
  };

  const today = todayIso();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <SheetHeader
          theme={theme}
          title={saved ? `Bag #${saved.labelNo}` : editing ? 'Fix this bag' : 'New bag'}
          left={{ label: saved ? 'Close' : 'Cancel', onPress: onClose }}
          right={saved ? undefined : { label: 'Save', onPress: save, strong: true }}
        />
        {saved ? (
          <ScrollView contentContainerStyle={styles.savedScroll}>
            <LabelTape bag={saved} />
            <Text style={[styles.savedNote, { color: theme.inkSoft }]}>
              It is on the {LOCATION_LABEL[saved.location].toLowerCase()} shelf now, in line by its use-by date.
            </Text>
            <PillAction theme={theme} tall label="Done" onPress={onClose} />
          </ScrollView>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
              <View style={styles.preview}>
                <BagDrawing
                  theme={theme}
                  width={118}
                  number={`#${labelNo}`}
                  date={fmtShortDate(pumpedOn)}
                  amount={fmtVol(volumeMl, unit)}
                  fill={volumeMl / BAG_CAPACITY_ML}
                  frozen={location !== 'fridge'}
                  seed={labelNo}
                />
              </View>
              <Section theme={theme} first>
                <Nudge
                  theme={theme}
                  label="Amount"
                  value={volNumber(volumeMl, unit)}
                  unit={unitLabel(unit)}
                  onStep={(d) => setVolumeMl((v) => stepVolume(v, d, unit))}
                  onTyped={(t) => {
                    const v = parseVolume(t, unit);
                    if (v != null) setVolumeMl(v);
                  }}
                />
                <Nudge
                  theme={theme}
                  label="Pumped"
                  value={fmtRelDay(pumpedOn, today)}
                  onStep={(d) => setPumpedOn((p) => (d > 0 && p >= todayIso() ? p : addDays(p, d)))}
                />
                <Nudge theme={theme} label="Bag number" value={`#${labelNo}`} onStep={(d) => setLabelNo((n) => Math.max(1, n + d))} />
              </Section>
              <Section theme={theme} title="Where it goes">
                <View style={{ paddingVertical: 10 }}>
                  <Tabs theme={theme} value={location} onChange={(l) => (tick(), setLocation(l))} options={LOCATIONS.map((l) => ({ value: l, label: LOCATION_LABEL[l] }))} />
                </View>
                <Entry theme={theme} label="Use by" sub="From your storage times in Settings" value={fmtDate(useBy(draft, settings))} />
              </Section>
            </ScrollView>
            <View style={{ paddingBottom: insets.bottom }}>
              <ThumbBar theme={theme}>
                <View style={{ flex: 1 }}>
                  <PillAction theme={theme} tall label={editing ? 'Save the fix' : 'Put it on the shelf'} onPress={save} />
                </View>
              </ThumbBar>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

/**
 * Everything you can do with one bag: use it, move it, toss it, see its tape.
 * onDone reports what happened so the stash can slide it off and offer Undo.
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
  const { settings, bumpData, say } = useApp();
  if (!bag) return null;
  const thawed = isThawed(bag);
  const expired = bagStatus(bag, settings, todayIso()) === 'expired';

  const act = async (fn: () => Promise<void>, what?: 'used' | 'discarded', line?: string) => {
    await fn();
    tick();
    onClose();
    if (what) onDone(bag, what);
    else bumpData();
    if (line) say(line);
  };

  // Thawed milk does not go back in a freezer.
  const moves = LOCATIONS.filter((l) => l !== bag.location && !(thawed && l !== 'fridge'));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <SheetHeader theme={theme} title={`Bag #${bag.labelNo}`} right={{ label: 'Done', onPress: onClose, strong: true }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
            <LabelTape bag={bag} />
          </View>
          <Text style={[styles.status, { color: expired ? theme.danger : theme.inkSoft }]}>
            {expired
              ? 'Past its use-by date.'
              : thawed
                ? 'Thawing in the fridge. Use it within a day, and it does not go back in the freezer.'
                : `On the ${LOCATION_LABEL[bag.location].toLowerCase()} shelf.`}
          </Text>
          <Section theme={theme}>
            {moves.map((l) => (
              <Entry
                key={l}
                theme={theme}
                label={l === 'fridge' ? 'Move to the fridge to thaw' : `Move to the ${LOCATION_LABEL[l].toLowerCase()}`}
                sub={l === 'fridge' ? 'Its use-by becomes tomorrow' : undefined}
                onPress={() => act(() => moveBag(bag.id, l), undefined, `Bag #${bag.labelNo} moved to the ${LOCATION_LABEL[l].toLowerCase()}.`)}
              />
            ))}
            <Entry theme={theme} label="Toss it" sub={expired ? undefined : 'Spilled, spoiled, or just not using it'} onPress={() => act(() => markBagDiscarded(bag.id), 'discarded')} />
            <Entry theme={theme} label="Fix a typo" onPress={() => onEdit(bag.id)} />
            <Entry
              theme={theme}
              label="Added by mistake"
              danger
              onPress={() =>
                Alert.alert('Delete this bag?', 'Only for a bag that was never real. To use or toss it, pick Used it or Toss it.', [
                  { text: 'Keep it', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => act(() => deleteBag(bag.id)) },
                ])
              }
            />
          </Section>
        </ScrollView>
        {!expired && (
          <View style={{ paddingBottom: insets.bottom }}>
            <ThumbBar theme={theme}>
              <View style={{ flex: 1 }}>
                <PillAction theme={theme} tall icon="check" label="Used it" onPress={() => act(() => markBagUsed(bag.id), 'used')} />
              </View>
            </ThumbBar>
          </View>
        )}
        {expired && (
          <View style={{ paddingBottom: insets.bottom }}>
            <ThumbBar theme={theme}>
              <View style={{ flex: 1 }}>
                <PillAction theme={theme} tall label="Toss it" onPress={() => act(() => markBagDiscarded(bag.id), 'discarded')} />
              </View>
            </ThumbBar>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  labelWrap: { gap: 10 },
  labelHint: { fontFamily: fonts.soft, fontSize: 17 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  savedScroll: { padding: 20, paddingTop: 28, gap: 20 },
  savedNote: { fontSize: 16, lineHeight: 22 },
  preview: { alignItems: 'center', paddingTop: 22, paddingBottom: 8 },
  status: { fontSize: 16, lineHeight: 22, paddingHorizontal: 20, paddingTop: 18 },
});
