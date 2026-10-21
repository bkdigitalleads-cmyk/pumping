import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Theme } from '../theme';
import { fmtHm, ReminderAnchor } from '../logic';

/**
 * The start-or-end choice, drawn: a 9:00 to 9:20 session on a time line,
 * and where the next reminder lands when the interval counts from its start
 * or from its end. The chosen one is in the accent color.
 */
/** Room kept to the right of the bar for "9:20" at 14 pt bold. */
const END_LABEL_W = 36;

export default function ReminderDiagram({
  theme,
  intervalMin,
  anchor,
}: {
  theme: Theme;
  intervalMin: number;
  /** Null shows both as equals (the value screen). */
  anchor: ReminderAnchor | null;
}) {
  const [w, setW] = useState(0);
  const base = new Date(2026, 0, 5, 9, 0).getTime();
  const sessionMin = 20;
  const span = intervalMin + sessionMin + 30;
  const x = (min: number) => 18 + (min / span) * (w - 36);
  const barEnd = Math.max(x(sessionMin), x(0) + 8);
  const color = (a: ReminderAnchor) => (anchor == null || anchor === a ? theme.accent : theme.inkFaint);
  const rows: { a: ReminderAnchor; from: number; y: number; label: string }[] = [
    { a: 'start', from: 0, y: 70, label: 'from the start' },
    { a: 'end', from: sessionMin, y: 118, label: 'from the end' },
  ];
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 150, alignSelf: 'stretch' }}
      accessible
      accessibilityLabel={`A session from 9:00 to 9:20. Counting from the start, the next reminder is at ${fmtHm(base + intervalMin * 60_000)}. Counting from the end, at ${fmtHm(base + (sessionMin + intervalMin) * 60_000)}.`}
    >
      {w > 0 && (
        <Svg width={w} height={150}>
          {/*
            The start time sits above the bar's start; the end time sits to the
            right of the bar, on the bar's own row, with the time line broken
            around it. Different rows, so the two never touch at any width.
          */}
          <Rect x={x(0)} y={18} width={Math.max(8, barEnd - x(0))} height={20} rx={4} fill={theme.milk} stroke={theme.plasticEdge} />
          {x(span) > barEnd + END_LABEL_W + 10 && (
            <Line x1={barEnd + END_LABEL_W + 10} x2={x(span)} y1={28} y2={28} stroke={theme.rule} strokeWidth={1.5} />
          )}
          <SvgText x={x(0)} y={12} fontSize={14} fill={theme.inkSoft} fontWeight="700">
            9:00
          </SvgText>
          <SvgText x={barEnd + 5} y={33} fontSize={14} fill={theme.inkSoft} fontWeight="700">
            9:20
          </SvgText>
          {rows.map((r) => {
            const end = r.from + intervalMin;
            const c = color(r.a);
            return (
              <React.Fragment key={r.a}>
                <Line x1={x(r.from)} x2={x(r.from)} y1={38} y2={r.y} stroke={c} strokeWidth={1.5} strokeDasharray="3 3" />
                <Line x1={x(r.from)} x2={x(end)} y1={r.y} y2={r.y} stroke={c} strokeWidth={2} strokeDasharray="6 4" />
                <Circle cx={x(end)} cy={r.y} r={6} fill={c} />
                <SvgText x={x(r.from) + 6} y={r.y - 8} fontSize={15} fill={c} fontWeight="600">
                  {r.label}
                </SvgText>
                <SvgText x={x(end)} y={r.y + 22} fontSize={16} fill={c} fontWeight="700" textAnchor="middle">
                  {fmtHm(base + end * 60_000)}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
