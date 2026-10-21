import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useTheme, fonts, Theme } from '../theme';
import { useApp, FREE_TREND_DAYS } from '../state';
import { getAllSessions, getSessionsBetween } from '../db';
import {
  addDays,
  dailyTotals,
  DayTotal,
  fmtAmPm,
  fmtDay,
  fmtDuration,
  fmtHm,
  fmtVol,
  isoFromMs,
  Session,
  sessionsCsv,
  startOfDayMs,
  summarize,
  todayIso,
  toUnit,
  Unit,
  volNumber,
} from '../logic';
import { shareSupplyLog } from '../report';
import PdfPreview from './PdfPreview';
import Figures from '../ui/Figures';
import { Entry, Section, Tabs } from '../ui/List';
import { PillAction, Press } from '../ui/Press';
import Icon from '../icons';

type Range = '7' | '30' | '90';
type PdfRange = '7' | '14' | '30' | '90';

export default function TrendsScreen({ onOpenSession }: { onOpenSession: (id: number) => void }) {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, settings } = useApp();
  const [range, setRange] = useState<Range>('7');
  const [pdfRange, setPdfRange] = useState<PdfRange>('14');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const unit = settings.unit;
  const days = Number(range);
  const today = todayIso();
  const from = addDays(today, -(days - 1));

  const load = useCallback(async () => {
    const t = todayIso();
    setSessions(await getSessionsBetween(startOfDayMs(addDays(t, -(days - 1))), startOfDayMs(addDays(t, 1))));
  }, [days]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  // 30 and 90 days are Pro; back to 7 if Pro ends.
  useEffect(() => {
    if (!isPro && range !== '7') setRange('7');
  }, [isPro, range]);

  const rows = dailyTotals(sessions, from, today);
  const s = summarize(rows);

  const pickRange = (r: Range) => {
    if (r !== '7' && !isPro) return showPaywall();
    setRange(r);
  };

  const onPdf = async () => {
    if (!isPro) return showPaywall();
    try {
      setBusy(true);
      await shareSupplyLog(Number(pdfRange));
    } catch (e: any) {
      Alert.alert('The PDF did not come out', e?.message ?? 'Try once more.');
    } finally {
      setBusy(false);
    }
  };

  const onCsv = async () => {
    if (!isPro) return showPaywall();
    try {
      setBusy(true);
      const file = new File(Paths.cache, 'pumping-sessions.csv');
      if (file.exists) file.delete();
      file.write(sessionsCsv(await getAllSessions()));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Your pumping sessions' });
      }
    } catch (e: any) {
      Alert.alert('The export did not work', e?.message ?? 'Try once more.');
    } finally {
      setBusy(false);
    }
  };

  // Share or Print in the preview: close it first (one sheet at a time on iOS), then the paywall.
  const onPreviewLocked = () => {
    setPreviewOpen(false);
    setTimeout(showPaywall, 400);
  };

  const headline =
    s.sessions === 0
      ? `Last ${days} days. The bars start with your first session.`
      : `Last ${days} days. About ${fmtVol(s.avgPerDayMl, unit)} a day.`;
  const sideLine =
    s.leftPct == null
      ? 'Left and right show up here once you log amounts.'
      : Math.abs(s.leftPct - 50) <= 2
        ? 'Left and right, about even.'
        : `The ${s.leftPct > 50 ? 'left' : 'right'} side did ${Math.max(s.leftPct, 100 - s.leftPct)}%.`;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.head}>
        <Text style={[styles.headline, { color: theme.ink }]} accessibilityRole="header">
          {headline}
        </Text>
      </View>
      <View style={{ marginTop: 10 }}>
        <Tabs
          theme={theme}
          value={range}
          onChange={pickRange}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days', tag: isPro ? undefined : 'PRO' },
            { value: '90', label: '90 days', tag: isPro ? undefined : 'PRO' },
          ]}
        />
      </View>

      <BarChart theme={theme} rows={rows} goalMl={settings.dailyGoalMl} unit={unit} />

      <Section theme={theme} title="The numbers">
        <Ledger theme={theme} label="A day, on days you pumped" value={fmtVol(s.avgPerDayMl, unit)} />
        <Ledger theme={theme} label="A session, on average" value={fmtVol(s.avgPerSessionMl, unit)} />
        <Ledger theme={theme} label="Sessions a day" value={s.avgSessionsPerDay.toFixed(1)} />
        <Ledger theme={theme} label={s.bestDay ? `Best day, ${fmtDay(s.bestDay.date)}` : 'Best day'} value={s.bestDay ? fmtVol(s.bestDay.totalMl, unit) : '0'} />
      </Section>

      <Section theme={theme} title="Left and right" note={sideLine}>
        <View style={styles.splitWrap}>
          <View style={[styles.split, { backgroundColor: theme.sunk }]}>
            {s.leftPct != null && (
              <>
                <View style={{ flex: s.leftPct, backgroundColor: theme.left }} />
                <View style={{ flex: 100 - s.leftPct, backgroundColor: theme.right }} />
              </>
            )}
          </View>
          <View style={styles.splitRow}>
            <Text style={[styles.splitText, { color: theme.left }]}>Left {fmtVol(s.leftMl, unit)}</Text>
            <Text style={[styles.splitText, { color: theme.right }]}>Right {fmtVol(s.rightMl, unit)}</Text>
          </View>
        </View>
      </Section>

      <Section theme={theme} title="For your lactation consultant or pediatrician">
        <View style={styles.shareBody}>
          <Text style={[styles.shareText, { color: theme.inkSoft }]}>
            The supply log PDF: daily totals, sessions a day, averages and the left and right split.
          </Text>
          {isPro ? (
            <>
              <Tabs
                theme={theme}
                inset={0}
                value={pdfRange}
                onChange={setPdfRange}
                options={[
                  { value: '7', label: '7 d' },
                  { value: '14', label: '14 d' },
                  { value: '30', label: '30 d' },
                  { value: '90', label: '90 d' },
                ]}
              />
              <PillAction theme={theme} icon="share" label={busy ? 'Making it' : 'Make the PDF'} onPress={onPdf} disabled={busy} />
            </>
          ) : (
            <PillAction theme={theme} icon="doc" label="See a preview" onPress={() => setPreviewOpen(true)} />
          )}
        </View>
        <Entry
          theme={theme}
          label={isPro ? 'Spreadsheet (CSV)' : 'Spreadsheet (CSV), Pro'}
          sub="Every session, in oz and mL"
          onPress={busy ? undefined : onCsv}
        />
      </Section>

      {sessions.length > 0 && (
        <Section theme={theme} title={`Every session, last ${days} days`}>
          {[...sessions]
            .reverse()
            .slice(0, 60)
            .map((x) => (
              <Press
                key={x.id}
                onPress={() => onOpenSession(x.id)}
                style={[styles.item, { borderBottomColor: theme.rule }]}
                pressedStyle={{ backgroundColor: theme.sunk }}
                accessibilityRole="button"
                accessibilityLabel={`${fmtDay(isoFromMs(x.startedAt))}, ${fmtHm(x.startedAt)} ${fmtAmPm(x.startedAt)}, ${fmtVol(x.leftMl + x.rightMl, unit)}. Edit.`}
              >
                <View style={styles.itemWhen}>
                  <Text style={[styles.itemDay, { color: theme.inkFaint }]}>{fmtDay(isoFromMs(x.startedAt))}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                    <Figures value={fmtHm(x.startedAt)} size={18} color={theme.ink} />
                    <Text style={[styles.itemAmPm, { color: theme.inkFaint }]}>{fmtAmPm(x.startedAt)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemAmount, { color: theme.ink }]}>{fmtVol(x.leftMl + x.rightMl, unit)}</Text>
                  <Text style={[styles.itemMeta, { color: theme.inkFaint }]}>
                    L {volNumber(x.leftMl, unit)} · R {volNumber(x.rightMl, unit)} · {fmtDuration(x.durationSec)}
                  </Text>
                </View>
                <Icon name="chevronRight" size={16} color={theme.inkFaint} />
              </Press>
            ))}
        </Section>
      )}
      <PdfPreview visible={previewOpen} days={FREE_TREND_DAYS} onClose={() => setPreviewOpen(false)} onLocked={onPreviewLocked} />
    </ScrollView>
  );
}

/** A line of the ledger: words on the left, the number on the right, dotted between. */
function Ledger({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  return (
    <View style={[styles.ledger, { borderBottomColor: theme.rule }]} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={[styles.ledgerLabel, { color: theme.inkSoft }]}>{label}</Text>
      <View style={[styles.dots, { borderBottomColor: theme.rule }]} />
      <Figures value={value} size={22} color={theme.ink} />
    </View>
  );
}

const CHART_H = 190;

/** Daily totals as milk columns, with printed marks up the side like a bottle and the goal dashed across. */
function BarChart({ theme, rows, goalMl, unit }: { theme: Theme; rows: DayTotal[]; goalMl: number; unit: Unit }) {
  const [w, setW] = useState(0);
  const n = rows.length;
  const axis = 34;
  const max = Math.max(goalMl, ...rows.map((r) => r.totalMl)) * 1.08 || 1;
  const plotW = Math.max(0, w - axis);
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(2, slot * (n <= 7 ? 0.5 : 0.66));
  const y = (ml: number) => CHART_H - (ml / max) * CHART_H;
  const maxU = toUnit(max, unit);
  const step = [5, 10, 20, 50, 100, 200, 500].find((s) => maxU / s <= 5) ?? 1000;
  const marks: number[] = [];
  for (let v = step; v < maxU; v += step) marks.push(v);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width - 40)}
      style={styles.chart}
      accessible
      accessibilityLabel={`Daily totals for ${n} days. Highest ${fmtVol(Math.max(0, ...rows.map((r) => r.totalMl)), unit)}. Goal ${fmtVol(goalMl, unit)}.`}
    >
      {w > 0 && (
        <Svg width={w} height={CHART_H + 22}>
          {marks.map((v) => {
            const yy = CHART_H - (v / maxU) * CHART_H;
            return (
              <React.Fragment key={v}>
                <Line x1={axis - 8} x2={axis - 2} y1={yy} y2={yy} stroke={theme.inkFaint} strokeWidth={1} />
                <SvgText x={axis - 11} y={yy + 4} fontSize={10} fill={theme.inkFaint} textAnchor="end" fontWeight="600">
                  {v}
                </SvgText>
              </React.Fragment>
            );
          })}
          <Line x1={axis - 2} x2={axis - 2} y1={0} y2={CHART_H} stroke={theme.rule} strokeWidth={1} />
          {rows.map((r, i) => {
            const x = axis + i * slot + (slot - barW) / 2;
            return r.totalMl > 0 ? (
              <React.Fragment key={r.date}>
                <Rect x={x} y={y(r.totalMl)} width={barW} height={CHART_H - y(r.totalMl)} rx={Math.min(5, barW / 2)} fill={theme.milk} stroke={theme.plasticEdge} strokeWidth={1} />
                <Rect x={x} y={y(r.totalMl)} width={barW} height={2} fill={r.totalMl >= goalMl ? theme.success : theme.accent} />
              </React.Fragment>
            ) : (
              <Rect key={r.date} x={x} y={CHART_H - 2} width={barW} height={2} fill={theme.rule} />
            );
          })}
          <Line x1={axis} x2={w} y1={y(goalMl)} y2={y(goalMl)} stroke={theme.accent} strokeWidth={1.4} strokeDasharray="5 4" />
          <SvgText x={w - 2} y={y(goalMl) - 6} fontSize={11} fill={theme.accent} textAnchor="end" fontWeight="700">
            {`goal ${volNumber(goalMl, unit)}`}
          </SvgText>
          {rows.map((r, i) => {
            const show = n <= 7 || i === 0 || i === n - 1;
            if (!show) return null;
            const label = n <= 7 ? new Date(startOfDayMs(r.date)).toLocaleDateString('en-US', { weekday: 'narrow' }) : i === n - 1 ? 'today' : fmtDay(r.date);
            return (
              <SvgText
                key={r.date}
                x={n <= 7 ? axis + i * slot + slot / 2 : i === 0 ? axis : w}
                y={CHART_H + 16}
                fontSize={11}
                fill={theme.inkFaint}
                textAnchor={n <= 7 ? 'middle' : i === 0 ? 'start' : 'end'}
                fontWeight="600"
              >
                {label}
              </SvgText>
            );
          })}
        </Svg>
      )}
      <Text style={[styles.chartUnit, { color: theme.inkFaint }]}>{unit === 'oz' ? 'oz' : 'mL'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 18 },
  headline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 37 },
  chart: { marginTop: 18, paddingHorizontal: 20 },
  chartUnit: { position: 'absolute', left: 20, top: -14, fontSize: 10, fontWeight: '700' },
  ledger: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 20, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  ledgerLabel: { fontSize: 16 },
  dots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', marginTop: 10 },
  splitWrap: { paddingHorizontal: 20, paddingVertical: 14 },
  split: { flexDirection: 'row', height: 12, overflow: 'hidden' },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  splitText: { fontSize: 15, fontWeight: '600' },
  shareBody: { paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  shareText: { fontSize: 15, lineHeight: 21 },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 20, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemWhen: { width: 86 },
  itemDay: { fontSize: 12, fontWeight: '600' },
  itemAmPm: { fontSize: 12, fontWeight: '600' },
  itemAmount: { fontFamily: fonts.display, fontSize: 19 },
  itemMeta: { fontSize: 14, marginTop: 1 },
});
