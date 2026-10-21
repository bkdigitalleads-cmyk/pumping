import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Theme, fonts } from '../theme';

/**
 * A strip of masking tape: torn ends, a faint edge, a slight tilt. What is
 * written on it goes in the marker font.
 */
export default function Tape({
  theme,
  children,
  rotate = -1.5,
  seed = 1,
  style,
  color,
}: {
  theme: Theme;
  children: React.ReactNode;
  rotate?: number;
  seed?: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={[{ transform: [{ rotate: `${rotate}deg` }] }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path d={tornPath(size.w, size.h, seed)} fill={color ?? theme.tape} stroke={theme.tapeEdge} strokeWidth={1} />
        </Svg>
      )}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

/** Marker writing, for tape and bag stripes. */
export function Marker({
  theme,
  children,
  size = 20,
  color,
  style,
  drawn = false,
}: {
  theme: Theme;
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  /** Part of a drawing (a bag stripe): sized with the drawing, not with Dynamic Type. */
  drawn?: boolean;
}) {
  return (
    <Text
      style={[{ fontFamily: fonts.marker, fontSize: size, lineHeight: size * 1.15, color: color ?? theme.marker }, style]}
      maxFontSizeMultiplier={1.3}
      allowFontScaling={!drawn}
      numberOfLines={drawn ? 1 : undefined}
    >
      {children}
    </Text>
  );
}

/** Jagged left and right ends, like tape torn by hand. Deterministic per seed. */
function tornPath(w: number, h: number, seed: number): string {
  let r = seed * 9301 + 49297;
  const rand = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  const teeth = Math.max(3, Math.round(h / 6));
  const step = h / teeth;
  let d = `M3 0 L${w - 3} 0`;
  for (let i = 1; i <= teeth; i++) d += ` L${w - (i % 2 ? rand() * 4 : 0.5)} ${(i * step).toFixed(1)}`;
  d += ` L3 ${h}`;
  for (let i = teeth - 1; i >= 0; i--) d += ` L${i % 2 ? rand() * 4 : 0.5} ${(i * step).toFixed(1)}`;
  return d + ' Z';
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 14, paddingVertical: 6 },
});
