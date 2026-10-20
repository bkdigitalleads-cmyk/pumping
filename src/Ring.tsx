import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Theme, fonts } from './theme';
import { fmtVol, Unit, unitLabel, volNumber } from './logic';

/**
 * Today's total against the daily goal: one soft ring that fills clockwise,
 * a small cream bead at the tip, and around the inside one tick per planned
 * pump, darkened as each session is logged. The number in the middle is the
 * day's total.
 */
const SIZE = 252;
const STROKE = 22;

export default function TodayRing({
  theme,
  totalMl,
  goalMl,
  unit,
  sessionsToday,
  pumpsPerDay,
}: {
  theme: Theme;
  totalMl: number;
  goalMl: number;
  unit: Unit;
  sessionsToday: number;
  pumpsPerDay: number;
}) {
  const c = SIZE / 2;
  const r = c - STROKE / 2 - 2;
  const pct = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;
  const circ = 2 * Math.PI * r;
  const met = goalMl > 0 && totalMl >= goalMl;
  const tipAngle = pct * 2 * Math.PI - Math.PI / 2;
  const tickR1 = r - STROKE / 2 - 9;
  const tickR2 = tickR1 - 7;
  const ticks = Math.max(1, Math.min(16, pumpsPerDay));

  const a11y = `${fmtVol(totalMl, unit)} today, ${Math.round(pct * 100)} percent of your ${fmtVol(goalMl, unit)} goal. ${sessionsToday} of ${ticks} sessions.`;

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={a11y}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={c} cy={c} r={r} stroke={theme.ringTrack} strokeWidth={STROKE} fill="none" />
        {pct > 0 && (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={met ? theme.success : theme.accent}
            strokeWidth={STROKE}
            strokeLinecap={pct >= 1 ? 'butt' : 'round'}
            strokeDasharray={`${circ * pct} ${circ}`}
            fill="none"
            // Start at 12 o'clock and run clockwise.
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
        {pct > 0 && pct < 1 && (
          <Circle
            cx={c + r * Math.cos(tipAngle)}
            cy={c + r * Math.sin(tipAngle)}
            r={STROKE / 2 - 5}
            fill={theme.bg}
            opacity={0.9}
          />
        )}
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * 2 * Math.PI - Math.PI / 2;
          const done = i < sessionsToday;
          return (
            <Line
              key={i}
              x1={c + tickR1 * Math.cos(a)}
              y1={c + tickR1 * Math.sin(a)}
              x2={c + tickR2 * Math.cos(a)}
              y2={c + tickR2 * Math.sin(a)}
              stroke={done ? theme.accent : theme.border}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.big, { color: theme.text }]}>{volNumber(totalMl, unit)}</Text>
        <Text style={[styles.unit, { color: theme.textSecondary }]}>{unitLabel(unit)} today</Text>
        <Text style={[styles.goal, { color: met ? theme.success : theme.textFaint }]}>
          {met ? 'goal reached' : `of ${fmtVol(goalMl, unit)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  big: { fontFamily: fonts.display, fontSize: 64, lineHeight: 72 },
  unit: { fontSize: 15, fontWeight: fonts.weight.semibold, marginTop: -4 },
  goal: { fontFamily: fonts.soft, fontSize: 16, marginTop: 4 },
});
