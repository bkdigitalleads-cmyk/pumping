import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts, Theme } from '../theme';
import { Card, IconTile, PillButton } from '../components';
import Icon from '../icons';
import { useApp, FREE_BAG_LIMIT } from '../state';
import { getActiveBags, restoreBag } from '../db';
import {
  Bag,
  BagLocation,
  bagStatus,
  daysOfMilk,
  fmtDay,
  fmtVol,
  isThawed,
  LOCATION_LABEL,
  LOCATIONS,
  parseVolume,
  stashOrder,
  stashTotals,
  todayIso,
  unitLabel,
  useBy,
  volNumber,
} from '../logic';
import { BagForm, BagSheet, LOCATION_ICON } from './Bag';
import { shareCaregiverSheet } from '../report';

export default function StashScreen() {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, settings, updateSettings } = useApp();
  const [bags, setBags] = useState<Bag[]>([]);
  const [filter, setFilter] = useState<BagLocation | null>(null);
  const [formFor, setFormFor] = useState<{ id: number | null } | null>(null);
  const [sheet, setSheet] = useState<Bag | null>(null);
  const [undo, setUndo] = useState<{ bag: Bag; what: 'used' | 'discarded' } | null>(null);
  const [busy, setBusy] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unit = settings.unit;

  const load = useCallback(async () => setBags(await getActiveBags()), []);
  useEffect(() => {
    load();
  }, [load, dataVersion]);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const today = todayIso();
  const ordered = stashOrder(bags, settings);
  const good = ordered.filter((b) => bagStatus(b, settings, today) !== 'expired');
  const expired = ordered.filter((b) => bagStatus(b, settings, today) === 'expired');
  const next = good[0] ?? null;
  const totals = stashTotals(bags, settings, today);
  const grandMl = totals.totalMl + settings.startingStashMl;
  const days = daysOfMilk(grandMl, settings.babyNeedMl);
  // Unfiltered, the use-next bag has its own card above, so the list starts after it.
  const shown = filter ? good.filter((b) => b.location === filter) : good.slice(1);
  const atLimit = !isPro && bags.length >= FREE_BAG_LIMIT;

  const addBag = () => (atLimit ? showPaywall() : setFormFor({ id: null }));

  const onDone = (bag: Bag, what: 'used' | 'discarded') => {
    setUndo({ bag, what });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const onUndo = async () => {
    if (!undo) return;
    await restoreBag(undo.bag.id);
    setUndo(null);
    load();
  };

  const onCaregiver = async () => {
    if (!isPro) return showPaywall();
    if (good.length === 0 && settings.startingStashMl === 0) {
      Alert.alert('Nothing in the stash yet', 'Add a bag or two first, then make the sheet.');
      return;
    }
    try {
      setBusy(true);
      await shareCaregiverSheet();
    } catch (e: any) {
      Alert.alert('Couldn’t make the sheet', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const editStarting = () =>
    Alert.prompt?.(
      'Milk from before',
      `How much, in ${unitLabel(unit)}? Use 0 to clear it.`,
      (text) => {
        const v = parseVolume(text, unit);
        if (v != null) updateSettings({ startingStashMl: v });
      },
      'plain-text',
      volNumber(settings.startingStashMl, unit),
      'decimal-pad'
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: theme.text }]}>Stash</Text>
          <Pressable
            onPress={onCaregiver}
            disabled={busy}
            hitSlop={8}
            style={[styles.sheetBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
            accessibilityLabel="Caregiver sheet PDF"
          >
            <Icon name="doc" size={18} color={theme.accent} />
            <Text style={[styles.sheetText, { color: theme.accent }]}>{busy ? 'Making it' : 'Caregiver sheet'}</Text>
            {!isPro && (
              <View style={[styles.proTag, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.proTagText, { color: theme.accent }]}>PRO</Text>
              </View>
            )}
          </Pressable>
        </View>

        <Card theme={theme} style={styles.totalCard}>
          <Text style={[styles.totalBig, { color: theme.text }]}>
            {volNumber(grandMl, unit)}
            <Text style={[styles.totalUnit, { color: theme.textSecondary }]}> {unitLabel(unit)}</Text>
          </Text>
          <Text style={[styles.totalSoft, { color: theme.textSecondary }]}>
            {days != null
              ? `about ${days} ${days === 1 ? 'day' : 'days'} of milk at ${fmtVol(settings.babyNeedMl ?? 0, unit)} a day`
              : `in ${totals.count} ${totals.count === 1 ? 'bag' : 'bags'}`}
          </Text>
          <View style={styles.tiles}>
            {LOCATIONS.map((l) => {
              const on = filter === l;
              const t = totals.byLocation[l];
              return (
                <Pressable
                  key={l}
                  onPress={() => setFilter(on ? null : l)}
                  style={[styles.tile, { backgroundColor: on ? theme.accentSoft : theme.cardAlt, borderColor: on ? theme.accent : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${LOCATION_LABEL[l]}, ${fmtVol(t.ml, unit)} in ${t.count} bags. Tap to show only these.`}
                >
                  <Icon name={LOCATION_ICON[l]} size={20} color={l === 'fridge' ? theme.accent : theme.frost} />
                  <Text style={[styles.tileVal, { color: theme.text }]}>{fmtVol(t.ml, unit)}</Text>
                  <Text style={[styles.tileLabel, { color: theme.textFaint }]}>
                    {LOCATION_LABEL[l]} · {t.count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {settings.babyNeedMl == null && (
            <Text style={[styles.hint, { color: theme.textFaint }]}>Add your baby's daily amount in Settings to see days of milk.</Text>
          )}
        </Card>

        {settings.startingStashMl > 0 && (
          <Card theme={theme} style={styles.startCard}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.startTitle, { color: theme.text }]}>
                Milk from before: {fmtVol(settings.startingStashMl, unit)}
              </Text>
              <Text style={[styles.startBody, { color: theme.textSecondary }]}>
                Counted in your total. As you add these as dated bags, lower or clear this line.
              </Text>
            </View>
            <Pressable onPress={editStarting} hitSlop={10} accessibilityLabel="Change milk from before">
              <Icon name="pencil" size={20} color={theme.accent} />
            </Pressable>
          </Card>
        )}

        {next && !filter && (
          <Pressable onPress={() => setSheet(next)} accessibilityRole="button" accessibilityLabel={`Use next: bag ${next.labelNo}`}>
            <Card theme={theme} style={{ ...styles.nextCard, borderColor: theme.accent, backgroundColor: theme.accentSoft }}>
              <Text style={[styles.nextTag, { color: theme.accent }]}>USE NEXT</Text>
              <BagLine theme={theme} bag={next} unit={unit} big />
            </Card>
          </Pressable>
        )}

        <View style={{ marginTop: 16 }}>
          <PillButton theme={theme} big icon="plus" label="Add a bag" onPress={addBag} />
        </View>
        {!isPro && (
          <Pressable onPress={showPaywall}>
            <Text style={[styles.limit, { color: theme.accent }]}>
              {atLimit
                ? `Your free stash holds ${FREE_BAG_LIMIT} bags. Pumping Pro holds the whole freezer.`
                : `Free holds ${FREE_BAG_LIMIT} bags (${bags.length} in use). Pumping Pro holds the whole freezer.`}
            </Text>
          </Pressable>
        )}

        {good.length === 0 && expired.length === 0 ? (
          <Card theme={theme} style={styles.empty}>
            <IconTile theme={theme} icon="snowflake" />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Your stash starts with one bag</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Add a bag when you chill or freeze milk. They line up oldest first, each with the day to use it by.
            </Text>
          </Card>
        ) : (
          <>
            <Text style={[styles.section, { color: theme.textSecondary }]}>
              {filter ? `${LOCATION_LABEL[filter]}, use-next order` : 'After that'}
            </Text>
            {shown.map((b) => (
              <Pressable key={b.id} onPress={() => setSheet(b)} accessibilityRole="button">
                <Card theme={theme} style={styles.item}>
                  <BagLine theme={theme} bag={b} unit={unit} />
                </Card>
              </Pressable>
            ))}
            {shown.length === 0 && (
              <Text style={[styles.hint, { color: theme.textFaint, textAlign: 'center' }]}>
                {filter ? 'Nothing here right now.' : next ? 'Just the one bag for now.' : ''}
              </Text>
            )}
            {expired.length > 0 && (
              <>
                <Text style={[styles.section, { color: theme.danger }]}>Past use-by</Text>
                {expired.map((b) => (
                  <Pressable key={b.id} onPress={() => setSheet(b)} accessibilityRole="button">
                    <Card theme={theme} style={{ ...styles.item, backgroundColor: theme.dangerSoft, borderColor: theme.dangerSoft }}>
                      <BagLine theme={theme} bag={b} unit={unit} />
                    </Card>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {undo && (
        <View style={[styles.undo, { backgroundColor: theme.text }]}>
          <Text style={[styles.undoText, { color: theme.bg }]}>
            Bag #{undo.bag.labelNo} {undo.what === 'used' ? 'marked used' : 'discarded'}
          </Text>
          <Pressable onPress={onUndo} hitSlop={12}>
            <Text style={[styles.undoBtn, { color: theme.bg }]}>Undo</Text>
          </Pressable>
        </View>
      )}

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

function BagLine({ theme, bag, unit, big = false }: { theme: Theme; bag: Bag; unit: 'oz' | 'ml'; big?: boolean }) {
  const { settings } = useApp();
  const status = bagStatus(bag, settings, todayIso());
  const thawing = isThawed(bag);
  const color = status === 'expired' ? theme.danger : status === 'soon' ? theme.accent : theme.textSecondary;
  return (
    <View style={styles.bagRow}>
      <View style={[styles.badge, big && styles.badgeBig, { backgroundColor: theme.cardAlt }]}>
        <Text style={[styles.badgeText, big && styles.badgeTextBig, { color: theme.text }]}>#{bag.labelNo}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bagVol, big && { fontSize: 26 }, { color: theme.text }]}>{fmtVol(bag.volumeMl, unit)}</Text>
        <View style={styles.bagMetaRow}>
          <Icon name={LOCATION_ICON[bag.location]} size={14} color={bag.location === 'fridge' ? theme.accent : theme.frost} />
          <Text style={[styles.bagMeta, { color: theme.textFaint }]}>
            {thawing ? 'Thawing' : LOCATION_LABEL[bag.location]} · pumped {fmtDay(bag.pumpedOn)}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.useByK, { color }]}>{status === 'expired' ? 'Was due' : 'Use by'}</Text>
        <Text style={[styles.useByV, { color }]}>{fmtDay(useBy(bag, settings))}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 100 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42 },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  sheetText: { fontSize: 14, fontWeight: '600' },
  proTag: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  proTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  totalCard: { alignItems: 'center', paddingVertical: 22 },
  totalBig: { fontFamily: fonts.display, fontSize: 56, lineHeight: 64 },
  totalUnit: { fontSize: 20, fontFamily: fonts.heading },
  totalSoft: { fontFamily: fonts.soft, fontSize: 17, marginTop: 2, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 18, alignSelf: 'stretch' },
  tile: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 4, borderWidth: 1.5, minHeight: 84 },
  tileVal: { fontFamily: fonts.display, fontSize: 17 },
  tileLabel: { fontSize: 11, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 12, lineHeight: 18 },
  startCard: { marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  startTitle: { fontSize: 16, fontWeight: '600' },
  startBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  nextCard: { marginTop: 12, borderWidth: 1.5 },
  nextTag: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  limit: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 10 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, marginTop: 28, marginBottom: 10, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8, marginTop: 20 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 22, marginTop: 6, textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 10 },
  item: { marginBottom: 10, paddingVertical: 14 },
  bagRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  badgeBig: { width: 62, height: 62, borderRadius: 31 },
  badgeText: { fontFamily: fonts.display, fontSize: 17 },
  badgeTextBig: { fontSize: 22 },
  bagVol: { fontFamily: fonts.display, fontSize: 20 },
  bagMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  bagMeta: { fontSize: 13 },
  useByK: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  useByV: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  undo: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 18,
    paddingHorizontal: 18,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  undoText: { fontSize: 15, fontWeight: '600' },
  undoBtn: { fontSize: 16, fontWeight: '800' },
});
