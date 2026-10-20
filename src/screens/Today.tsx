import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts } from '../theme';
import { Card, IconTile, PillButton } from '../components';
import Icon from '../icons';
import TodayRing from '../Ring';
import { useApp, FREE_SESSION_LIMIT } from '../state';
import { countSessions, getLastSession, getSessionsBetween } from '../db';
import {
  addDays,
  fmtClock,
  fmtCountdown,
  fmtDuration,
  fmtInterval,
  fmtTime,
  fmtVol,
  nextPumpAt,
  Session,
  startOfDayMs,
  todayIso,
  volNumber,
} from '../logic';

export default function TodayScreen({
  onStart,
  onLogPast,
  onOpenSession,
  onOpenSettings,
}: {
  onStart: () => void;
  onLogPast: () => void;
  onOpenSession: (id: number) => void;
  onOpenSettings: () => void;
}) {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, settings, active } = useApp();
  const [today, setToday] = useState(todayIso());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [last, setLast] = useState<Session | null>(null);
  const [count, setCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const unit = settings.unit;

  const load = useCallback(async () => {
    const day = todayIso();
    setToday(day);
    setSessions(await getSessionsBetween(startOfDayMs(day), startOfDayMs(addDays(day, 1))));
    setLast(await getLastSession());
    setCount(await countSessions());
  }, []);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  // The countdown and the timer card stay live; past midnight the day rolls over.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (todayIso() !== today) load();
    }, active ? 1000 : 20_000);
    return () => clearInterval(t);
  }, [active, today, load]);

  const totalMl = sessions.reduce((s, x) => s + x.leftMl + x.rightMl, 0);
  const left = FREE_SESSION_LIMIT - count;
  const next = nextPumpAt(last, settings.reminderIntervalMin, settings.reminderAnchor);
  const anchorWord = settings.reminderAnchor === 'start' ? 'start' : 'end';
  const dateLabel = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.date, { color: theme.textSecondary }]}>{dateLabel}</Text>
          <Text style={[styles.title, { color: theme.text }]}>Today</Text>
        </View>
        {!isPro && (
          <Pressable
            onPress={showPaywall}
            hitSlop={10}
            style={({ pressed }) => [styles.proBtn, { borderColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
            accessibilityLabel="Get Pumping Pro"
          >
            <Text style={[styles.proBtnText, { color: theme.accent }]}>Pro</Text>
          </Pressable>
        )}
      </View>

      <Card theme={theme} style={styles.ringCard}>
        <TodayRing
          theme={theme}
          totalMl={totalMl}
          goalMl={settings.dailyGoalMl}
          unit={unit}
          sessionsToday={sessions.length}
          pumpsPerDay={settings.pumpsPerDay}
        />
        <Text style={[styles.ringNote, { color: theme.textFaint }]}>
          {sessions.length} of {settings.pumpsPerDay} sessions
        </Text>
      </Card>

      {active ? (
        <Pressable onPress={onStart} accessibilityRole="button" accessibilityLabel="Return to the running session">
          <Card theme={theme} style={{ ...styles.activeCard, backgroundColor: theme.accent, borderColor: theme.accent }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeLabel, { color: theme.onAccent }]}>Pumping now</Text>
              <Text style={[styles.activeTimer, { color: theme.onAccent }]}>
                {fmtClock((now - active.startedAt) / 1000)}
              </Text>
            </View>
            <Text style={[styles.activeBack, { color: theme.onAccent }]}>Back to it</Text>
            <Icon name="chevronRight" size={20} color={theme.onAccent} />
          </Card>
        </Pressable>
      ) : (
        <>
          <Card theme={theme} style={styles.nextCard}>
            <Icon name="clock" size={26} color={theme.accent} />
            <View style={{ flex: 1 }}>
              {next == null ? (
                <>
                  <Text style={[styles.nextBig, { color: theme.text }]}>Next pump</Text>
                  <Text style={[styles.nextSub, { color: theme.textSecondary }]}>
                    Your first session starts the countdown.
                  </Text>
                </>
              ) : next > now ? (
                <>
                  <Text style={[styles.nextBig, { color: theme.text }]}>
                    {fmtCountdown(next - now)} <Text style={[styles.nextSoft, { color: theme.textSecondary }]}>to your next pump</Text>
                  </Text>
                  <Text style={[styles.nextSub, { color: theme.textSecondary }]}>
                    Around {fmtTime(next)}, {fmtInterval(settings.reminderIntervalMin)} from the {anchorWord} of your last session.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.nextBig, { color: theme.accent }]}>Time to pump</Text>
                  <Text style={[styles.nextSub, { color: theme.textSecondary }]}>
                    Your last session {settings.reminderAnchor === 'start' ? 'started' : 'ended'}{' '}
                    {fmtDuration((now - (settings.reminderAnchor === 'start' ? last!.startedAt : last!.endedAt)) / 1000)} ago.
                  </Text>
                </>
              )}
              {!settings.reminderEnabled && (
                <Pressable onPress={onOpenSettings} hitSlop={8}>
                  <Text style={[styles.nextLink, { color: theme.accent }]}>Turn on reminders</Text>
                </Pressable>
              )}
            </View>
          </Card>

          <View style={{ marginTop: 16 }}>
            <PillButton theme={theme} big icon="drop" label="Start pumping" onPress={onStart} />
          </View>
          <Pressable onPress={onLogPast} hitSlop={8} style={styles.pastBtn} accessibilityRole="button">
            <Icon name="pastClock" size={18} color={theme.accent} />
            <Text style={[styles.pastText, { color: theme.accent }]}>Log a past session</Text>
          </Pressable>
        </>
      )}

      {!isPro && (
        <Pressable onPress={showPaywall}>
          <Card theme={theme} style={{ ...styles.limitCard, backgroundColor: theme.accentSoft }}>
            <Text style={[styles.limitText, { color: theme.accent }]}>
              {left <= 0
                ? `You've logged your ${FREE_SESSION_LIMIT} free sessions. Pumping Pro keeps every one.`
                : `${left} free ${left === 1 ? 'session' : 'sessions'} left. Pumping Pro keeps every one.`}
            </Text>
          </Card>
        </Pressable>
      )}

      <Text style={[styles.section, { color: theme.textSecondary }]}>Today's sessions</Text>
      {sessions.length === 0 ? (
        <Card theme={theme} style={styles.empty}>
          <IconTile theme={theme} icon="bottle" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>A fresh day</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Your sessions land here as you log them. Every one counts, the small ones too.
          </Text>
        </Card>
      ) : (
        [...sessions].reverse().map((s) => (
          <Pressable key={s.id} onPress={() => onOpenSession(s.id)} accessibilityRole="button">
            <Card theme={theme} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTime, { color: theme.text }]}>{fmtTime(s.startedAt)}</Text>
                <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                  {fmtDuration(s.durationSec)} · L {volNumber(s.leftMl, unit)} · R {volNumber(s.rightMl, unit)}
                  {s.note ? ' · note' : ''}
                </Text>
              </View>
              <Text style={[styles.itemTotal, { color: theme.text }]}>{fmtVol(s.leftMl + s.rightMl, unit)}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  topRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 },
  date: { fontFamily: fonts.soft, fontSize: 16 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42 },
  proBtn: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', marginBottom: 6 },
  proBtnText: { fontSize: 15, fontFamily: fonts.display },
  ringCard: { alignItems: 'center', paddingVertical: 24 },
  ringNote: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  activeCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 20 },
  activeLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.4 },
  activeTimer: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] },
  activeBack: { fontSize: 16, fontWeight: '600' },
  nextCard: { marginTop: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  nextBig: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  nextSoft: { fontFamily: fonts.soft, fontSize: 17 },
  nextSub: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  nextLink: { fontSize: 15, fontWeight: '600', marginTop: 10 },
  pastBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 6 },
  pastText: { fontSize: 16, fontWeight: '600' },
  limitCard: { marginTop: 10, borderWidth: 0, paddingVertical: 14 },
  limitText: { fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 21 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, marginTop: 28, marginBottom: 10, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 22, marginTop: 6 },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 10 },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingVertical: 14, minHeight: 64 },
  itemTime: { fontFamily: fonts.heading, fontSize: 19 },
  itemMeta: { fontSize: 14, marginTop: 2 },
  itemTotal: { fontFamily: fonts.display, fontSize: 22 },
});
