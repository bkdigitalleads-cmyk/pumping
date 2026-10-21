import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme, fonts } from '../theme';
import { buildCaregiverData, buildSupplyData } from '../report';
import { addDays, fmtDay, fmtShortDate, fmtVol, fromUnit, todayIso, Unit, useBy } from '../logic';
import Tape, { Marker } from './Tape';

/**
 * A small, real look at one of the Pro PDFs, taped to the page: the
 * supply log or the caregiver sheet, filled with the parent's own numbers
 * when there are any, and with a clearly marked example when there are not.
 */
export default function MiniSheet({
  theme,
  kind,
  unit,
  maxRows = 5,
}: {
  theme: Theme;
  kind: 'supply' | 'caregiver';
  unit: Unit;
  /** Fewer rows on short screens; 0 shows just the title and the summary. */
  maxRows?: number;
}) {
  const [rows, setRows] = useState<{ a: string; b: string; c: string; bar?: number }[] | null>(null);
  const [summary, setSummary] = useState('');
  const [example, setExample] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (kind === 'supply') {
          const d = await buildSupplyData(7);
          if (!live) return;
          if (d.summary.sessions > 0) {
            const max = Math.max(...d.rows.map((r) => r.totalMl), 1);
            setRows([...d.rows].reverse().slice(0, 5).map((r) => ({ a: fmtDay(r.date), b: `${r.count}`, c: r.count ? fmtVol(r.totalMl, unit) : 'none', bar: r.totalMl / max })));
            setSummary(`${fmtVol(d.summary.avgPerDayMl, unit)} a day · ${d.summary.avgSessionsPerDay.toFixed(1)} sessions a day`);
            return;
          }
        } else {
          const d = await buildCaregiverData();
          if (!live) return;
          if (d.bags.length > 0) {
            setRows(d.bags.slice(0, 5).map((b, i) => ({ a: i === 0 ? `Next  #${b.labelNo}` : `#${b.labelNo}`, b: fmtVol(b.volumeMl, unit), c: `by ${fmtShortDate(useBy(b, d.settings))}` })));
            setSummary(`${fmtVol(d.totalMl, unit)} stored, oldest first`);
            return;
          }
        }
      } catch {
        // fall through to the example
      }
      if (!live) return;
      setExample(true);
      const t = todayIso();
      const oz = (n: number) => fmtVol(fromUnit(n, 'oz'), unit);
      if (kind === 'supply') {
        const totals = [26, 24.5, 27, 25, 23.5];
        setRows(totals.map((v, i) => ({ a: fmtDay(addDays(t, -i)), b: '8', c: oz(v), bar: v / 27 })));
        setSummary(`${oz(25)} a day · 8 sessions a day`);
      } else {
        setRows([4, 5, 3.5, 4.5].map((v, i) => ({ a: i === 0 ? `Next  #${i + 1}` : `#${i + 1}`, b: oz(v), c: `by ${fmtShortDate(addDays(t, 150 + i * 6))}` })));
        setSummary(`${oz(17)} stored, oldest first`);
      }
    })();
    return () => {
      live = false;
    };
  }, [kind, unit]);

  const title = kind === 'supply' ? 'Pumping supply log' : 'Milk stash, caregiver sheet';
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`A preview of the ${kind === 'supply' ? 'supply log' : 'caregiver sheet'} PDF${example ? ', with example numbers' : ''}`}>
      <View style={[styles.paper, { backgroundColor: theme.paper, borderColor: theme.rule }]}>
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        <Text style={[styles.sub, { color: theme.inkSoft }]}>{summary}</Text>
        {maxRows > 0 && <View style={[styles.rule, { backgroundColor: theme.accent }]} />}
        {(rows ?? []).slice(0, maxRows).map((r, i) => (
          <View key={i} style={[styles.row, { borderBottomColor: theme.rule }]}>
            <Text style={[styles.cell, styles.cellA, { color: theme.ink, fontWeight: i === 0 && kind === 'caregiver' ? '700' : '400' }]}>{r.a}</Text>
            {r.bar != null ? (
              <View style={styles.barCell}>
                <View style={[styles.bar, { width: `${Math.round(r.bar * 100)}%`, backgroundColor: theme.milkLine }]} />
              </View>
            ) : null}
            <Text style={[styles.cell, { color: theme.inkSoft }]}>{r.b}</Text>
            <Text style={[styles.cell, styles.cellC, { color: theme.ink }]}>{r.c}</Text>
          </View>
        ))}
        {example && (
          <View style={styles.stamp} pointerEvents="none">
            <Marker theme={theme} size={22} color={theme.accent}>
              example
            </Marker>
          </View>
        )}
      </View>
      <View style={styles.tape} pointerEvents="none">
        <Tape theme={theme} rotate={-4} seed={kind === 'supply' ? 7 : 11}>
          <View style={{ width: 54, height: 8 }} />
        </Tape>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 10, paddingHorizontal: 6 },
  paper: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, transform: [{ rotate: '1.2deg' }] },
  title: { fontFamily: fonts.display, fontSize: 16 },
  sub: { fontSize: 11, marginTop: 2 },
  rule: { height: 2, marginTop: 8, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { fontSize: 11 },
  cellA: { width: 92 },
  cellC: { marginLeft: 'auto', fontWeight: '700' },
  barCell: { flex: 1, height: 6 },
  bar: { height: 6 },
  stamp: { position: 'absolute', right: 14, top: 10, transform: [{ rotate: '-8deg' }] },
  tape: { position: 'absolute', top: 0, alignSelf: 'center', left: '38%' },
});
