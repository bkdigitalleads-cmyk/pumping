import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { Theme, fonts } from '../theme';
import { useReduceMotion } from './motion';

/**
 * One shelf of the fridge or freezer: a name and what is on it, then the
 * bags standing in rows on a wire shelf. Square-edged, full-bleed.
 */
export default function Shelf({
  theme,
  title,
  summary,
  children,
  perRow = 3,
}: {
  theme: Theme;
  title: string;
  summary: string;
  /** Rendered as (bagWidth) => bag elements, so bags fit the screen. */
  children: (bagWidth: number) => React.ReactNode[];
  perRow?: number;
}) {
  const [w, setW] = useState(0);
  const gap = 14;
  const bagW = w > 0 ? Math.floor((w - gap * (perRow - 1)) / perRow) : 0;
  const items = bagW > 0 ? children(bagW) : [];
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));

  return (
    <View style={styles.wrap}>
      <View style={styles.head} accessibilityRole="header">
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        <Text style={[styles.summary, { color: theme.inkSoft }]}>{summary}</Text>
      </View>
      <View style={styles.inner} onLayout={(e) => setW(e.nativeEvent.layout.width - 40)}>
        {rows.map((row, i) => (
          <View key={i}>
            <View style={[styles.row, { gap }]}>{row}</View>
            <WireShelf theme={theme} width={w} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** The wire shelf the bags stand on: a front bar and the wires behind it. */
function WireShelf({ theme, width }: { theme: Theme; width: number }) {
  if (width <= 0) return null;
  const wires = Math.floor(width / 14);
  return (
    <Svg width={width + 40} height={16} style={{ marginLeft: -20, marginTop: -2, marginBottom: 18 }}>
      {Array.from({ length: wires + 3 }, (_, i) => (
        <Line key={i} x1={8 + i * 14} y1={0} x2={2 + i * 14} y2={9} stroke={theme.shelf} strokeWidth={1} />
      ))}
      <Rect x={0} y={8} width={width + 40} height={4} rx={2} fill={theme.shelf} />
    </Svg>
  );
}

/** A bag that was just used or tossed slides off the shelf, then calls onGone. */
export function SlideOff({ active, children, onGone }: { active: boolean; children: React.ReactNode; onGone?: () => void }) {
  const reduce = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const done = useRef(onGone);
  done.current = onGone;
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      done.current?.();
      return;
    }
    Animated.timing(x, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
      done.current?.()
    );
  }, [active, reduce, x]);
  return (
    <Animated.View
      style={{
        opacity: x.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }) },
          { rotate: x.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '8deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 26 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14, gap: 10 },
  title: { fontFamily: fonts.heading, fontSize: 21 },
  summary: { fontSize: 15, flexShrink: 1, textAlign: 'right' },
  inner: { paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
