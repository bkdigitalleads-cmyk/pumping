import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useTheme, fonts, Theme } from '../theme';
import { Card, PillButton, ProBadge, Segmented } from '../components';
import { useApp, FREE_TREND_DAYS } from '../state';
import { getAllSessions, getSessionsBetween } from '../db';
import {
  addDays,
  dailyTotals,
  DayTotal,
  fmtDay,
  fmtDuration,
  fmtTime,
  fmtVol,
  isoFromMs,
  Session,
  sessionsCsv,
  startOfDayMs,
  summarize,
  todayIso,
  Unit,
  volNumber,
} from '../logic';
import { shareSupplyLog } from '../report';
import PdfPreview from './PdfPreview';

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
      Alert.alert('Couldn’t make the PDF', e?.message ?? 'Please try again.');
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
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Share or Print in the preview: close it first (one sheet at a time on iOS), then the paywall.
  const onPreviewLocked = () => {
    setPreviewOpen(false);
    setTimeout(showPaywall, 400);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: theme.text }]}>Trends</Text>
      <Segmented
        theme={theme}
        value={range}
        onChange={pickRange}
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days', badge: !isPro ? <ProBadge theme={theme} /> : undefined },
          { value: '90', label: '90 days', badge: !isPro ? <ProBadge theme={theme} /> : undefined },
        ]}
      />

      <Card theme={theme} style={{ marginTop: 16 }}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Daily totals</Text>
        <Text style={[styles.cardSub, { color: theme.textFaint }]}>
          Dashed line: your goal of {fmtVol(settings.dailyGoalMl, unit)}
        </Text>
        <BarChart theme={theme} rows={rows} goalMl={settings.dailyGoalMl} unit={unit} />
        {s.sessions === 0 && (
          <Text style={[styles.cardSub, { color: theme.textSecondary, textAlign: 'center', marginTop: 8 }]}>
            Your bars grow here as the days fill in.
          </Text>
        )}
      </Card>

      <View style={styles.grid}>
        <Stat theme={theme} v={fmtVol(s.avgPerDayMl, unit)} l="a day, on days logged" />
        <Stat theme={theme} v={fmtVol(s.avgPerSessionMl, unit)} l="a session, on average" />
        <Stat theme={theme} v={s.avgSessionsPerDay.toFixed(1)} l="sessions a day" />
        <Stat theme={theme} v={s.bestDay ? fmtVol(s.bestDay.totalMl, unit) : '0'} l={s.bestDay ? `best day, ${fmtDay(s.bestDay.date)}` : 'best day'} />
      </View>

      <Card theme={theme} style={{ marginTop: 12 }}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Left and right</Text>
        <View style={[styles.split, { backgroundColor: theme.ringTrack }]}>
          {s.leftPct != null && (
            <>
              <View style={{ flex: s.leftPct, backgroundColor: theme.left }} />
              <View style={{ flex: 100 - s.leftPct, backgroundColor: theme.right }} />
            </>
          )}
        </View>
        <View style={styles.splitRow}>
          <Text style={[styles.splitText, { color: theme.left }]}>
            Left {fmtVol(s.leftMl, unit)}
            {s.leftPct != null ? `, ${s.leftPct}%` : ''}
          </Text>
          <Text style={[styles.splitText, { color: theme.right }]}>
            Right {fmtVol(s.rightMl, unit)}
            {s.leftPct != null ? `, ${100 - s.leftPct}%` : ''}
          </Text>
        </View>
      </Card>

      <Text style={[styles.section, { color: theme.textSecondary }]}>Share</Text>
      <Card theme={theme} style={{ gap: 12 }}>
        <View style={styles.exportTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Supply log PDF</Text>
          {!isPro && <ProBadge theme={theme} />}
        </View>
        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
          Daily totals, sessions per day, averages and the left and right split, ready for your lactation consultant or
          pediatrician.
        </Text>
        {isPro ? (
          <>
            <Segmented
              theme={theme}
              value={pdfRange}
              onChange={setPdfRange}
              options={[
                { value: '7', label: '7 d' },
                { value: '14', label: '14 d' },
                { value: '30', label: '30 d' },
                { value: '90', label: '90 d' },
              ]}
            />
            <PillButton theme={theme} icon="share" label={busy ? 'Making it' : 'Create PDF'} onPress={onPdf} disabled={busy} />
          </>
        ) : (
          <PillButton theme={theme} icon="doc" label="Preview my supply log" onPress={() => setPreviewOpen(true)} />
        )}
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
        <View style={styles.exportTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Spreadsheet (CSV)</Text>
          {!isPro && <ProBadge theme={theme} />}
        </View>
        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Every session, in oz and mL. Yours to keep.</Text>
        <PillButton theme={theme} kind="ghost" label={busy ? 'Making it' : 'Export CSV'} onPress={onCsv} disabled={busy} />
      </Card>

      {sessions.length > 0 && (
        <>
          <Text style={[styles.section, { color: theme.textSecondary }]}>Sessions, last {days} days</Text>
          {[...sessions]
            .reverse()
            .slice(0, 60)
            .map((x) => (
              <Pressable key={x.id} onPress={() => onOpenSession(x.id)} accessibilityRole="button">
                <Card theme={theme} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTime, { color: theme.text }]}>
                      {fmtDay(isoFromMs(x.startedAt))}, {fmtTime(x.startedAt)}
                    </Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                      {fmtDuration(x.durationSec)} · L {volNumber(x.leftMl, unit)} · R {volNumber(x.rightMl, unit)}
                    </Text>
                  </View>
                  <Text style={[styles.itemTotal, { color: theme.text }]}>{fmtVol(x.leftMl + x.rightMl, unit)}</Text>
                </Card>
              </Pressable>
            ))}
        </>
      )}
      <PdfPreview visible={previewOpen} days={FREE_TREND_DAYS} onClose={() => setPreviewOpen(false)} onLocked={onPreviewLocked} />
    </ScrollView>
  );
}

function Stat({ theme, v, l }: { theme: Theme; v: string; l: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statV, { color: theme.text }]}>{v}</Text>
      <Text style={[styles.statL, { color: theme.textFaint }]}>{l}</Text>
    </View>
  );
}

const CHART_H = 170;

function BarChart({ theme, rows, goalMl, unit }: { theme: Theme; rows: DayTotal[]; goalMl: number; unit: Unit }) {
  const [w, setW] = useState(0);
  const n = rows.length;
  const max = Math.max(goalMl, ...rows.map((r) => r.totalMl)) * 1.12 || 1;
  const slot = n > 0 ? w / n : 0;
  const barW = Math.max(2, slot * (n <= 7 ? 0.56 : 0.7));
  const y = (ml: number) => CHART_H - (ml / max) * CHART_H;
  const labelEvery = n <= 7 ? 1 : n <= 30 ? 7 : 30;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ marginTop: 14 }}
      accessible
      accessibilityLabel={`Daily totals for ${n} days. Highest ${fmtVol(Math.max(0, ...rows.map((r) => r.totalMl)), unit)}.`}
    >
      {w > 0 && (
        <Svg width={w} height={CHART_H}>
          {rows.map((r, i) =>
            r.totalMl > 0 ? (
              <Rect
                key={r.date}
                x={i * slot + (slot - barW) / 2}
                y={y(r.totalMl)}
                width={barW}
                height={CHART_H - y(r.totalMl)}
                rx={Math.min(6, barW / 2)}
                fill={r.totalMl >= goalMl ? theme.success : theme.accent}
              />
            ) : (
              <Rect key={r.date} x={i * slot + (slot - barW) / 2} y={CHART_H - 3} width={barW} height={3} rx={1.5} fill={theme.border} />
            )
          )}
          <Line x1={0} x2={w} y1={y(goalMl)} y2={y(goalMl)} stroke={theme.textFaint} strokeWidth={1.2} strokeDasharray="5 5" />
        </Svg>
      )}
      <View style={styles.labels}>
        {rows.map((r, i) => {
          const show = (n - 1 - i) % labelEvery === 0;
          return (
            <Text key={r.date} style={[styles.barLabel, { width: slot, color: theme.textFaint }]} numberOfLines={1}>
              {show
                ? n <= 7
                  ? new Date(startOfDayMs(r.date)).toLocaleDateString('en-US', { weekday: 'narrow' })
                  : ''
                : ''}
            </Text>
          );
        })}
      </View>
      {n > 7 && (
        <View style={styles.rangeLabels}>
          <Text style={[styles.barLabel, { color: theme.textFaint }]}>{fmtDay(rows[0].date)}</Text>
          <Text style={[styles.barLabel, { color: theme.textFaint }]}>Today</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, marginTop: 8, marginBottom: 16 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 19 },
  cardSub: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: { flexBasis: '47%', flexGrow: 1, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  statV: { fontFamily: fonts.display, fontSize: 24 },
  statL: { fontSize: 13, marginTop: 2 },
  split: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 14 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  splitText: { fontSize: 15, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, marginTop: 28, marginBottom: 10, marginLeft: 4 },
  exportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  labels: { flexDirection: 'row', marginTop: 6 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 11, textAlign: 'center', fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingVertical: 14 },
  itemTime: { fontFamily: fonts.heading, fontSize: 17 },
  itemMeta: { fontSize: 14, marginTop: 2 },
  itemTotal: { fontFamily: fonts.display, fontSize: 20 },
});
