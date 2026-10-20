import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../theme';
import Icon from '../icons';
import { useApp } from '../state';
import { buildSupplyData, SupplyData } from '../report';
import { fmtDate, fmtDay, fmtVol } from '../logic';

/**
 * Free users' look at their supply log: the same content as the PDF, drawn
 * as a paper page with a large SAMPLE watermark. Nothing here can leave the
 * phone; Share and Print close the preview and open the paywall. Same
 * approach as Odo 1.0.6.
 */

// Paper colors, the same in light and dark mode, like the printed PDF.
const PAPER = {
  bg: '#FFFDF8',
  ink: '#33241D',
  sub: '#6F5B4F',
  faint: '#A39083',
  rule: '#EFE4D6',
  clay: '#A8503A',
  plum: '#7A6A96',
  box: '#FAF3E8',
  boxBorder: '#EADCC9',
};

export default function PdfPreview({
  visible,
  days,
  onClose,
  onLocked,
}: {
  visible: boolean;
  days: number;
  onClose: () => void;
  /** Share or Print tapped: the parent closes this and opens the paywall. */
  onLocked: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { dataVersion } = useApp();
  const [data, setData] = useState<SupplyData | null>(null);

  useEffect(() => {
    if (!visible) return;
    setData(null);
    buildSupplyData(days).then(setData).catch(() => setData(null));
  }, [visible, days, dataVersion]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.cardAlt }]}>
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.bg }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Preview</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close preview">
            <Icon name="close" color={theme.textFaint} />
          </Pressable>
        </View>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          This is a preview of your supply log. Pumping Pro shares or prints the real thing.
        </Text>

        <ScrollView contentContainerStyle={styles.scroll}>
          {!data ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.page}>
              <Sheet d={data} />
              <View style={styles.watermarkLayer} pointerEvents="none">
                {[0, 1, 2].map((i) => (
                  <Text key={i} style={styles.watermark} accessibilityElementsHidden>
                    SAMPLE
                  </Text>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View
          style={[styles.bar, { borderTopColor: theme.border, backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <BarButton label="Share" icon="share" onPress={onLocked} />
          <BarButton label="Print" icon="doc" onPress={onLocked} />
        </View>
      </View>
    </Modal>
  );
}

function BarButton({ label, icon, onPress }: { label: string; icon: 'share' | 'doc'; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.barBtn, { borderColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}
      accessibilityLabel={`${label}, needs Pumping Pro`}
    >
      <Icon name={icon} size={18} color={theme.accent} />
      <Text style={[styles.barBtnText, { color: theme.accent }]}>{label}</Text>
      <View style={[styles.proTag, { backgroundColor: theme.accentSoft }]}>
        <Text style={[styles.proTagText, { color: theme.accent }]}>PRO</Text>
      </View>
    </Pressable>
  );
}

/** The PDF's layout in native views, trimmed to what fits a phone. */
function Sheet({ d }: { d: SupplyData }) {
  const v = (ml: number) => fmtVol(ml, d.unit);
  const s = d.summary;
  return (
    <View>
      <Text style={styles.h1}>Pumping supply log</Text>
      <Text style={styles.sub}>
        {fmtDate(d.from)} to {fmtDate(d.to)} · Pumping for iPhone
      </Text>
      <View style={styles.summary}>
        <SumBox v={v(s.avgPerDayMl)} l="a day, days logged" />
        <SumBox v={v(s.avgPerSessionMl)} l="a session" />
        <SumBox v={s.avgSessionsPerDay.toFixed(1)} l="sessions a day" />
      </View>
      <View style={styles.split}>
        <View style={{ flex: s.leftPct ?? 50, backgroundColor: PAPER.clay }} />
        <View style={{ flex: 100 - (s.leftPct ?? 50), backgroundColor: PAPER.plum }} />
      </View>
      <Text style={styles.small}>
        Left {v(s.leftMl)} · Right {v(s.rightMl)}
      </Text>

      <View style={[styles.tr, styles.th]}>
        <Text style={[styles.thText, styles.cDay]}>Day</Text>
        <Text style={[styles.thText, styles.cNum]}>Sessions</Text>
        <Text style={[styles.thText, styles.cNum]}>Left</Text>
        <Text style={[styles.thText, styles.cNum]}>Right</Text>
        <Text style={[styles.thText, styles.cNum]}>Total</Text>
      </View>
      {[...d.rows].reverse().map((r) => (
        <View key={r.date} style={styles.tr}>
          <Text style={[styles.td, styles.cDay, r.count === 0 && styles.zero]}>{fmtDay(r.date)}</Text>
          <Text style={[styles.td, styles.cNum, r.count === 0 && styles.zero]}>{r.count}</Text>
          <Text style={[styles.td, styles.cNum]}>{r.count ? v(r.leftMl) : ''}</Text>
          <Text style={[styles.td, styles.cNum]}>{r.count ? v(r.rightMl) : ''}</Text>
          <Text style={[styles.td, styles.cNum, styles.bold, r.count === 0 && styles.zero]}>{r.count ? v(r.totalMl) : 'none'}</Text>
        </View>
      ))}
      <View style={[styles.tr, styles.totals]}>
        <Text style={[styles.td, styles.cDay, styles.bold]}>Totals</Text>
        <Text style={[styles.td, styles.cNum, styles.bold]}>{s.sessions}</Text>
        <Text style={[styles.td, styles.cNum, styles.bold]}>{v(s.leftMl)}</Text>
        <Text style={[styles.td, styles.cNum, styles.bold]}>{v(s.rightMl)}</Text>
        <Text style={[styles.td, styles.cNum, styles.bold]}>{v(s.totalMl)}</Text>
      </View>
      <Text style={[styles.small, { marginTop: 14, textAlign: 'center' }]}>
        A personal log recorded by the parent. Not a medical record or medical advice.
      </Text>
    </View>
  );
}

function SumBox({ v, l }: { v: string; l: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.boxV}>{v}</Text>
      <Text style={styles.boxL}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontFamily: fonts.heading },
  note: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 24, paddingTop: 12 },
  scroll: { padding: 16, paddingBottom: 32 },
  page: {
    backgroundColor: PAPER.bg,
    borderRadius: 8,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  watermarkLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'space-around' },
  watermark: {
    fontFamily: fonts.display,
    fontSize: 84,
    letterSpacing: 6,
    color: 'rgba(168, 80, 58, 0.2)',
    transform: [{ rotate: '-28deg' }],
  },
  h1: { fontSize: 18, fontFamily: fonts.display, color: PAPER.ink },
  sub: { fontSize: 10, color: PAPER.sub, marginTop: 2 },
  bold: { fontWeight: '700' },
  summary: { flexDirection: 'row', gap: 6, marginTop: 12 },
  box: { flex: 1, backgroundColor: PAPER.box, borderColor: PAPER.boxBorder, borderWidth: 1, borderRadius: 10, padding: 8 },
  boxV: { fontSize: 14, fontFamily: fonts.display, color: PAPER.ink },
  boxL: { fontSize: 9, color: PAPER.sub, marginTop: 1 },
  split: { flexDirection: 'row', height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  small: { fontSize: 9.5, color: PAPER.sub, marginTop: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PAPER.rule, paddingVertical: 5, gap: 4 },
  th: { borderBottomWidth: 2, borderBottomColor: PAPER.clay, marginTop: 12 },
  thText: { fontSize: 8.5, fontWeight: '600', color: PAPER.sub, letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: 10, color: PAPER.ink },
  zero: { color: PAPER.faint },
  cDay: { flex: 1.8 },
  cNum: { flex: 1, textAlign: 'right' },
  totals: { borderTopWidth: 2, borderTopColor: PAPER.clay, borderBottomWidth: 0 },
  bar: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  barBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 26,
    minHeight: 50,
  },
  barBtnText: { fontSize: 16, fontWeight: '600' },
  proTag: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  proTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});
