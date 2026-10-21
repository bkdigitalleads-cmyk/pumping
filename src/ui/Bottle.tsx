import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Theme } from '../theme';
import { toUnit, Unit } from '../logic';
import { useReduceMotion } from './motion';

/**
 * A bottle with printed graduations. The top mark is the daily goal, and
 * the milk level is today's total against it, so a full bottle is the goal
 * met. Marks are ounces or mL, whichever the parent uses. The milk rises
 * with a short ease when a session is saved (instantly with Reduce Motion).
 */
const VB_W = 140;
const VB_H = 280;
const BODY = 'M44 62 H96 Q108 62 110 76 L112 252 Q112 272 92 272 H48 Q28 272 28 252 L30 76 Q32 62 44 62 Z';
const GOAL_Y = 84;
const ZERO_Y = 262;

/** Where to put labeled marks: about 5 of them, on round numbers. */
function scaleFor(capacity: number): { major: number; minor: number } {
  const steps = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000];
  const major = steps.find((s) => capacity / s <= 6) ?? 1000;
  const minor = major >= 50 ? major / 5 : major >= 5 ? major / 5 : major / 2;
  return { major, minor };
}

export default function Bottle({
  theme,
  totalMl,
  goalMl,
  unit,
  height,
  ghost = false,
}: {
  theme: Theme;
  totalMl: number;
  goalMl: number;
  unit: Unit;
  height: number;
  ghost?: boolean;
}) {
  const reduce = useReduceMotion();
  const clipId = useRef(`bottle${Math.random().toString(36).slice(2, 8)}`).current;
  const level = goalMl > 0 ? Math.max(0, Math.min(1, totalMl / goalMl)) : 0;
  const anim = useRef(new Animated.Value(level)).current;
  // The level is mirrored into state on every frame and drawn as a plain
  // rect, which behaves the same on every platform (animated SVG props do not).
  const [shown, setShown] = useState(level);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setShown(value));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    if (reduce) {
      anim.setValue(level);
      return;
    }
    Animated.timing(anim, { toValue: level, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [level, reduce, anim]);

  const width = (height * VB_W) / VB_H;
  const capacity = toUnit(goalMl, unit);
  const { major, minor } = scaleFor(capacity);
  const yFor = (v: number) => ZERO_Y - (v / capacity) * (ZERO_Y - GOAL_Y);
  const ticks: { y: number; label?: string }[] = [];
  for (let v = minor; v < capacity - minor / 4; v += minor) {
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    ticks.push({ y: yFor(v), label: isMajor ? String(Math.round(v)) : undefined });
  }
  const goalLabel = String(Math.round(capacity * 2) / 2).replace('.5', '½');
  const milkY = ZERO_Y + 10 - shown * (ZERO_Y + 10 - GOAL_Y);
  const dash = ghost ? '5 4' : undefined;
  const edge = ghost ? theme.inkFaint : theme.plasticEdge;
  const mark = theme.inkFaint;

  return (
    <View style={{ width, height }} importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={BODY} />
          </ClipPath>
        </Defs>
        {/* nipple and collar */}
        <Path d="M58 40 C58 20 63 8 70 8 C77 8 82 20 82 40 Z" fill={ghost ? 'none' : theme.sunk} stroke={edge} strokeWidth={1.4} strokeDasharray={dash} />
        <Rect x={36} y={38} width={68} height={26} rx={6} fill={ghost ? 'none' : theme.accentSoft} stroke={ghost ? edge : theme.accent} strokeWidth={1.4} strokeDasharray={dash} />
        <Line x1={40} y1={46} x2={100} y2={46} stroke={ghost ? edge : theme.accent} strokeWidth={0.8} opacity={0.6} strokeDasharray={dash} />
        <Line x1={40} y1={56} x2={100} y2={56} stroke={ghost ? edge : theme.accent} strokeWidth={0.8} opacity={0.6} strokeDasharray={dash} />
        {/* body */}
        <Path d={BODY} fill={ghost ? 'none' : theme.plastic} stroke={edge} strokeWidth={1.6} strokeDasharray={dash} />
        {!ghost && (
          <G clipPath={`url(#${clipId})`}>
            <Rect x={0} y={milkY} width={VB_W} height={VB_H} fill={theme.milk} />
            <Rect x={0} y={milkY} width={VB_W} height={2.4} fill={theme.milkLine} />
            <Rect x={28} y={milkY} width={12} height={VB_H} fill={theme.milkLine} opacity={0.35} />
          </G>
        )}
        {/* printed graduations */}
        {ticks.map((t, i) => (
          <G key={i}>
            <Line x1={t.label ? 84 : 92} y1={t.y} x2={104} y2={t.y} stroke={mark} strokeWidth={t.label ? 1.3 : 0.9} />
            {t.label && (
              <SvgText x={80} y={t.y + 4} fontSize={11} fill={mark} textAnchor="end" fontWeight="600">
                {t.label}
              </SvgText>
            )}
          </G>
        ))}
        <Line x1={62} y1={GOAL_Y} x2={104} y2={GOAL_Y} stroke={theme.accent} strokeWidth={1.6} strokeDasharray="4 3" />
        <SvgText x={58} y={GOAL_Y + 4} fontSize={11} fill={theme.accent} textAnchor="end" fontWeight="700">
          {goalLabel}
        </SvgText>
        <SvgText x={104} y={GOAL_Y - 7} fontSize={9} fill={mark} textAnchor="end" fontWeight="600">
          {unit === 'oz' ? 'OZ' : 'ML'}
        </SvgText>
      </Svg>
    </View>
  );
}
