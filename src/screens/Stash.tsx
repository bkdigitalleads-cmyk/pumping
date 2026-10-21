import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts, Theme } from '../theme';
import { useApp, FREE_BAG_LIMIT } from '../state';
import { getActiveBags, restoreBag } from '../db';
import {
  Bag,
  BagLocation,
  bagStatus,
  daysOfMilk,
  fmtShortDate,
  fmtVol,
  isThawed,
  LOCATION_LABEL,
  LOCATIONS,
  parseVolume,
  plural,
  stashOrder,
  stashTotals,
  todayIso,
  unitLabel,
  useBy,
  volNumber,
} from '../logic';
import BagDrawing, { BAG_CAPACITY_ML } from '../ui/BagDrawing';
import Shelf, { SlideOff } from '../ui/Shelf';
import ThumbBar from '../ui/ThumbBar';
import { PillAction, Press, TextAction } from '../ui/Press';
import { BagForm, BagSheet } from './Bag';
import { shareCaregiverSheet } from '../report';

export default function StashScreen() {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, settings, updateSettings, bumpData } = useApp();
  const [bags, setBags] = useState<Bag[]>([]);
  const [formFor, setFormFor] = useState<{ id: number | null } | null>(null);
  const [sheet, setSheet] = useState<Bag | null>(null);
  // A bag that was just used or tossed stays drawn for a moment while it slides off the shelf.
  const [leaving, setLeaving] = useState<Bag | null>(null);
  const [undo, setUndo] = useState<{ bag: Bag; what: 'used' | 'discarded' } | null>(null);
  const [busy, setBusy] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unit = settings.unit;

  const load = useCallback(async () => setBags(await getActiveBags()), []);
  useEffect(() => {
    load();
  }, [load, dataVersion]);
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    []
  );

  const today = todayIso();
  const shown = leaving && !bags.some((b) => b.id === leaving.id) ? [...bags, leaving] : bags;
  const ordered = stashOrder(shown, settings);
  const next = ordered.find((b) => bagStatus(b, settings, today) !== 'expired' && b.id !== leaving?.id) ?? null;
  const totals = stashTotals(bags, settings, today);
  const grandMl = totals.totalMl + settings.startingStashMl;
  const days = daysOfMilk(grandMl, settings.babyNeedMl);
  const atLimit = !isPro && bags.length >= FREE_BAG_LIMIT;
  const empty = bags.length === 0 && !leaving;

  const addBag = () => (atLimit ? showPaywall() : setFormFor({ id: null }));

  const onDone = (bag: Bag, what: 'used' | 'discarded') => {
    setLeaving(bag);
    setUndo({ bag, what });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const onUndo = async () => {
    if (!undo) return;
    await restoreBag(undo.bag.id);
    setUndo(null);
    setLeaving(null);
    bumpData();
  };

  const onCaregiver = async () => {
    if (!isPro) return showPaywall();
    if (totals.count === 0 && settings.startingStashMl === 0) {
      Alert.alert('The sheet needs a bag or two', 'Add the bags in your freezer, then make the sheet.');
      return;
    }
    try {
      setBusy(true);
      await shareCaregiverSheet();
    } catch (e: any) {
      Alert.alert('The sheet did not come out', e?.message ?? 'Try once more.');
    } finally {
      setBusy(false);
    }
  };

  const editStarting = () =>
    Alert.prompt?.(
      'Milk from before',
      `About how much, in ${unitLabel(unit)}? Put 0 once it is all in dated bags.`,
      (text) => {
        const v = parseVolume(text, unit);
        if (v != null) updateSettings({ startingStashMl: v });
      },
      'plain-text',
      volNumber(settings.startingStashMl, unit),
      'decimal-pad'
    );

  const headline = empty
    ? 'Stash. Empty shelves for now.'
    : `Stash. ${fmtVol(grandMl, unit)} in ${plural(totals.count, 'bag')}${days != null ? `, about ${days} ${days === 1 ? 'day' : 'days'}` : ''}.`;

  const drawBag = (b: Bag, w: number) => {
    const status = bagStatus(b, settings, today);
    const isNext = next?.id === b.id;
    return (
      <SlideOff key={b.id} active={leaving?.id === b.id} onGone={() => load().then(() => (setLeaving(null), bumpData()))}>
        <Press
          onPress={() => setSheet(b)}
          accessibilityRole="button"
          accessibilityLabel={`Bag ${b.labelNo}, ${fmtVol(b.volumeMl, unit)}, pumped ${fmtShortDate(b.pumpedOn)}, use by ${fmtShortDate(useBy(b, settings))}${isNext ? ', use next' : ''}${status === 'expired' ? ', past its date' : ''}`}
          pressedStyle={{ opacity: 0.7, transform: [{ translateY: -3 }] }}
        >
          <BagDrawing
            theme={theme}
            width={w}
            number={`#${b.labelNo}`}
            date={fmtShortDate(b.pumpedOn)}
            amount={fmtVol(b.volumeMl, unit)}
            extra={isThawed(b) ? 'thawing' : `by ${fmtShortDate(useBy(b, settings))}`}
            fill={b.volumeMl / BAG_CAPACITY_ML}
            frozen={b.location !== 'fridge'}
            tape={status === 'expired' ? 'past date' : isNext ? 'use next' : undefined}
            tapeDanger={status === 'expired'}
            seed={b.id}
          />
        </Press>
      </SlideOff>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.head}>
          <Text style={[styles.headline, { color: theme.ink }]} accessibilityRole="header">
            {headline}
          </Text>
          <View style={styles.links}>
            <TextAction theme={theme} icon="doc" label={busy ? 'Making the sheet' : isPro ? 'Caregiver sheet' : 'Caregiver sheet, Pro'} onPress={onCaregiver} />
          </View>
          {settings.startingStashMl > 0 && (
            <Press onPress={editStarting} accessibilityRole="button" style={styles.before}>
              <Text style={[styles.beforeText, { color: theme.inkSoft }]}>
                Includes {fmtVol(settings.startingStashMl, unit)} from before, no dates. Tap to change.
              </Text>
            </Press>
          )}
          {settings.babyNeedMl == null && !empty && (
            <Text style={[styles.hint, { color: theme.inkFaint }]}>Add how much baby takes a day in Settings to see days of milk.</Text>
          )}
        </View>

        {empty ? (
          <Shelf theme={theme} title="Freezer" summary="nothing on it">
            {(w) => [
              <View key="ghost" accessible accessibilityLabel="An empty bag outline">
                <BagDrawing theme={theme} width={w} ghost number="#1" date={fmtShortDate(today)} />
              </View>,
            ]}
          </Shelf>
        ) : (
          LOCATIONS.map((loc: BagLocation) => {
            const here = ordered.filter((b) => b.location === loc);
            if (here.length === 0) return null;
            const t = totals.byLocation[loc];
            return (
              <Shelf key={loc} theme={theme} title={LOCATION_LABEL[loc]} summary={`${fmtVol(t.ml, unit)}, ${plural(t.count, 'bag')}`}>
                {(w) => here.map((b) => drawBag(b, w))}
              </Shelf>
            );
          })
        )}

        {empty && (
          <Text style={[styles.emptyLine, { color: theme.inkSoft }]}>
            Your first bag goes here. Write the date on it before it goes in the freezer.
          </Text>
        )}
        {!isPro && (
          <Press onPress={showPaywall} accessibilityRole="button" style={styles.limit}>
            <Text style={[styles.limitText, { color: theme.accent }]}>
              {atLimit
                ? `That is ${FREE_BAG_LIMIT} bags, the most the free stash holds. Pumping Pro holds the whole freezer.`
                : `The free stash holds ${FREE_BAG_LIMIT} bags. Pumping Pro holds the whole freezer.`}
            </Text>
          </Press>
        )}
      </ScrollView>

      {undo && (
        <View style={[styles.undo, { backgroundColor: theme.ink }]}>
          <Text style={[styles.undoText, { color: theme.bg }]}>
            Bag #{undo.bag.labelNo} {undo.what === 'used' ? 'used' : 'tossed'}.
          </Text>
          <Press onPress={onUndo} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.undoBtn, { color: theme.bg }]}>Undo</Text>
          </Press>
        </View>
      )}

      <ThumbBar theme={theme}>
        <View style={{ flex: 1 }}>
          <PillAction theme={theme} tall icon="plus" label="Add a bag" onPress={addBag} />
        </View>
      </ThumbBar>

      <BagForm visible={formFor != null} bagId={formFor?.id ?? null} onClose={() => setFormFor(null)} />
      <BagSheet
        bag={sheet}
        onClose={() => setSheet(null)}
        onEdit={(id) => {
          setSheet(null);
          setTimeout(() => setFormFor({ id }), 450);
        }}
        onDone={onDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 18 },
  headline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 37 },
  links: { flexDirection: 'row', marginTop: 2 },
  before: { minHeight: 36, justifyContent: 'center' },
  beforeText: { fontFamily: fonts.soft, fontSize: 16, lineHeight: 22 },
  hint: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  emptyLine: { fontFamily: fonts.soft, fontSize: 18, lineHeight: 25, paddingHorizontal: 20 },
  limit: { paddingHorizontal: 20, paddingTop: 10, minHeight: 44 },
  limitText: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  undo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 86,
    paddingHorizontal: 20,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  undoText: { fontSize: 16, fontWeight: '600' },
  undoBtn: { fontSize: 16, fontWeight: '800' },
});
