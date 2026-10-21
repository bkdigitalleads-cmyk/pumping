import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts, Theme } from '../theme';
import { useApp, FREE_SESSION_LIMIT } from '../state';
import { countSessions, getLastSession, getSessionsBetween } from '../db';
import {
  addDays,
  fmtAmPm,
  fmtClock,
  fmtCountdown,
  fmtDuration,
  fmtHm,
  fmtInterval,
  fmtVol,
  fmtWeekday,
  nextPumpAt,
  plural,
  Session,
  startOfDayMs,
  todayIso,
  Unit,
  volNumber,
} from '../logic';
import Bottle from '../ui/Bottle';
import Figures from '../ui/Figures';
import ThumbBar from '../ui/ThumbBar';
import { PillAction, Press, RoundButton, TextAction } from '../ui/Press';
import Icon from '../icons';

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

  // The countdown and the running timer stay live; past midnight the day rolls over.
  useEffect(() => {
    const t = setInterval(
      () => {
        setNow(Date.now());
        if (todayIso() !== today) load();
      },
      active ? 1000 : 20_000
    );
    return () => clearInterval(t);
  }, [active, today, load]);

  const totalMl = sessions.reduce((s, x) => s + x.leftMl + x.rightMl, 0);
  const left = FREE_SESSION_LIMIT - count;
  const goal = settings.dailyGoalMl;
  const toGo = goal - totalMl;

  const headline =
    sessions.length === 0
      ? `${fmtWeekday(now)}. Nothing in the bottle so far.`
      : `${fmtWeekday(now)}. ${plural(sessions.length, 'session')}, ${fmtVol(totalMl, unit)}.`;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} automaticallyAdjustKeyboardInsets>
        <View style={styles.head}>
          <Text style={[styles.headline, { color: theme.ink }]} accessibilityRole="header">
            {headline}
          </Text>
          {!isPro && (
            <Press onPress={showPaywall} accessibilityRole="button" hitSlop={6} style={styles.freeLine}>
              <Text style={[styles.freeText, { color: theme.accent }]}>
                {left <= 0
                  ? `That was your third free session. Pumping Pro keeps the rest.`
                  : `${plural(left, 'free session')} left. Pumping Pro keeps every one.`}
              </Text>
            </Press>
          )}
        </View>

        <View style={styles.bottleRow}>
          <SideNote theme={theme} sessions={sessions} unit={unit} />
          <Bottle theme={theme} totalMl={totalMl} goalMl={goal} unit={unit} height={300} ghost={sessions.length === 0} />
          <View style={styles.sideCol}>
            <Text style={[styles.goalSmall, { color: theme.inkFaint }]}>goal</Text>
            <Figures value={volNumber(goal, unit)} size={22} color={theme.inkSoft} />
            <Text style={[styles.goalSmall, { color: theme.inkFaint }]}>{unit === 'oz' ? 'oz' : 'mL'}</Text>
          </View>
        </View>
        <Text style={[styles.toGo, { color: toGo <= 0 && totalMl > 0 ? theme.success : theme.inkSoft }]}>
          {totalMl === 0
            ? 'The marks on the side go up to your goal.'
            : toGo <= 0
              ? 'Goal met. Anything more is a bonus.'
              : `${fmtVol(toGo, unit)} to go.`}
        </Text>

        <View style={[styles.next, { borderTopColor: theme.rule, borderBottomColor: theme.rule }]}>
          <Countdown theme={theme} now={now} last={last} active={active?.startedAt ?? null} />
          {!settings.reminderEnabled && !active && (
            <TextAction theme={theme} label="Turn on the reminder" onPress={onOpenSettings} icon="bell" />
          )}
        </View>

        <Timeline theme={theme} sessions={sessions} unit={unit} onOpen={onOpenSession} />
      </ScrollView>

      <ThumbBar theme={theme}>
        {!active && (
          <RoundButton theme={theme} icon="pastClock" label="Log a past session" onPress={onLogPast} size={60} filled />
        )}
        <View style={{ flex: 1 }}>
          <PillAction
            theme={theme}
            tall
            icon={active ? undefined : 'drop'}
            label={active ? `Back to it, ${fmtClock((now - active.startedAt) / 1000)}` : 'Start pumping'}
            onPress={onStart}
            hint={active ? 'Opens the running session' : 'Starts the timer'}
          />
        </View>
      </ThumbBar>
    </View>
  );
}

/** Left of the bottle: how today splits between the sides, in marker like a note on tape. */
function SideNote({ theme, sessions, unit }: { theme: Theme; sessions: Session[]; unit: Unit }) {
  const l = sessions.reduce((s, x) => s + x.leftMl, 0);
  const r = sessions.reduce((s, x) => s + x.rightMl, 0);
  return (
    <View style={styles.sideCol} accessible accessibilityLabel={`Left ${fmtVol(l, unit)}, right ${fmtVol(r, unit)}`}>
      <Text style={[styles.goalSmall, { color: theme.left }]}>left</Text>
      <Figures value={volNumber(l, unit)} size={22} color={theme.inkSoft} />
      <View style={{ height: 14 }} />
      <Text style={[styles.goalSmall, { color: theme.right }]}>right</Text>
      <Figures value={volNumber(r, unit)} size={22} color={theme.inkSoft} />
    </View>
  );
}

function Countdown({ theme, now, last, active }: { theme: Theme; now: number; last: Session | null; active: number | null }) {
  const { settings } = useApp();
  const anchor = settings.reminderAnchor;
  if (active != null) {
    return (
      <>
        <Text style={[styles.nextLabel, { color: theme.inkSoft }]}>Pumping now</Text>
        <Figures value={fmtClock((now - active) / 1000)} size={34} color={theme.ink} label={`Pumping for ${fmtDuration((now - active) / 1000)}`} />
      </>
    );
  }
  const next = nextPumpAt(last, settings.reminderIntervalMin, anchor);
  if (next == null || !last) {
    return (
      <>
        <Text style={[styles.nextLabel, { color: theme.inkSoft }]}>Next pump</Text>
        <Text style={[styles.nextBig, { color: theme.ink }]}>Starts with your first session.</Text>
      </>
    );
  }
  const from = anchor === 'start' ? last.startedAt : last.endedAt;
  if (next <= now) {
    return (
      <>
        <Text style={[styles.nextLabel, { color: theme.accent }]}>Time to pump</Text>
        <Figures value={`${fmtDuration((now - from) / 1000)} ago`} size={34} color={theme.ink} />
        <Text style={[styles.nextSoft, { color: theme.inkSoft }]}>since the last one {anchor === 'start' ? 'started' : 'ended'}.</Text>
      </>
    );
  }
  return (
    <>
      <Text style={[styles.nextLabel, { color: theme.inkSoft }]}>Next pump</Text>
      <Figures value={`in ${fmtCountdown(next - now)}`} size={34} color={theme.ink} />
      <Text style={[styles.nextSoft, { color: theme.inkSoft }]}>
        around {fmtHm(next)}, {fmtInterval(settings.reminderIntervalMin)} from the {anchor} of the last one.
      </Text>
    </>
  );
}

/** Today's sessions as a timeline: times on the left, hairlines between, no boxes. */
function Timeline({ theme, sessions, unit, onOpen }: { theme: Theme; sessions: Session[]; unit: Unit; onOpen: (id: number) => void }) {
  return (
    <View style={styles.timeline}>
      <Text style={[styles.tlTitle, { color: theme.ink }]} accessibilityRole="header">
        Sessions
      </Text>
      <View style={{ borderTopColor: theme.rule, borderTopWidth: StyleSheet.hairlineWidth }}>
        {sessions.length === 0 ? (
          <View style={[styles.tlRow, { borderBottomColor: theme.rule, borderStyle: 'dashed', borderBottomWidth: 1 }]}>
            <View style={styles.tlTime}>
              <Text style={[styles.tlGhost, { color: theme.rule }]}>0:00</Text>
            </View>
            <TimelineDot theme={theme} ghost />
            <Text style={[styles.tlEmpty, { color: theme.inkSoft }]}>Your first session of the day lands here.</Text>
          </View>
        ) : (
          [...sessions].reverse().map((s) => (
            <Press
              key={s.id}
              onPress={() => onOpen(s.id)}
              style={[styles.tlRow, { borderBottomColor: theme.rule }]}
              pressedStyle={{ backgroundColor: theme.sunk }}
              accessibilityRole="button"
              accessibilityLabel={`${fmtHm(s.startedAt)} ${fmtAmPm(s.startedAt)}, ${fmtVol(s.leftMl + s.rightMl, unit)}, ${fmtDuration(s.durationSec)}. Edit.`}
            >
              <View style={styles.tlTime}>
                <Figures value={fmtHm(s.startedAt)} size={19} color={theme.ink} />
                <Text style={[styles.tlAmPm, { color: theme.inkFaint }]}>{fmtAmPm(s.startedAt)}</Text>
              </View>
              <TimelineDot theme={theme} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.tlAmount, { color: theme.ink }]}>{fmtVol(s.leftMl + s.rightMl, unit)}</Text>
                <Text style={[styles.tlMeta, { color: theme.inkFaint }]}>
                  L {volNumber(s.leftMl, unit)} · R {volNumber(s.rightMl, unit)} · {fmtDuration(s.durationSec)}
                  {s.note ? ' · note' : ''}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={theme.inkFaint} />
            </Press>
          ))
        )}
      </View>
    </View>
  );
}

function TimelineDot({ theme, ghost = false }: { theme: Theme; ghost?: boolean }) {
  return (
    <View style={styles.dotCol}>
      <View style={[styles.dotLine, { backgroundColor: theme.rule }]} />
      <View
        style={[
          styles.dot,
          ghost ? { borderColor: theme.rule, borderWidth: 1.5, borderStyle: 'dashed' } : { backgroundColor: theme.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },
  head: { paddingHorizontal: 20, paddingTop: 18 },
  headline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 37 },
  freeLine: { minHeight: 36, justifyContent: 'center', marginTop: 4 },
  freeText: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  bottleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 14 },
  sideCol: { width: 56, alignItems: 'center' },
  goalSmall: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  toGo: { fontFamily: fonts.soft, fontSize: 17, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  next: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nextLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.6 },
  nextBig: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, marginTop: 2 },
  nextSoft: { fontFamily: fonts.soft, fontSize: 17, lineHeight: 23, marginTop: 2 },
  timeline: { paddingTop: 28 },
  tlTitle: { fontFamily: fonts.heading, fontSize: 21, paddingHorizontal: 20, marginBottom: 10 },
  tlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tlTime: { width: 70, flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  tlAmPm: { fontSize: 12, fontWeight: '600' },
  tlGhost: { fontFamily: fonts.display, fontSize: 19 },
  tlAmount: { fontFamily: fonts.display, fontSize: 20 },
  tlMeta: { fontSize: 14, marginTop: 1 },
  tlEmpty: { flex: 1, fontSize: 15, lineHeight: 21, paddingVertical: 12 },
  dotCol: { width: 12, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  dotLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
