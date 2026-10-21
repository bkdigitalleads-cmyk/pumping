import React from 'react';
import { StyleProp, Text, TextStyle, useWindowDimensions, View, ViewStyle } from 'react-native';
import { fonts } from '../theme';

/**
 * Numbers that change in place (the timer, amounts, the countdown) in
 * Fraunces without jitter. The font has no tabular figures, so each digit
 * sits in its own fixed-width cell; other characters keep their own width.
 * Cells grow with Dynamic Type, capped at `maxScale`.
 */
const DIGIT_EM = 0.68;

export default function Figures({
  value,
  size,
  color,
  font = fonts.display,
  maxScale = 1.6,
  style,
  label,
}: {
  value: string;
  size: number;
  color: string;
  font?: string;
  maxScale?: number;
  style?: StyleProp<ViewStyle>;
  /** VoiceOver text, when the digits alone don't say it well. */
  label?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(fontScale || 1, maxScale);
  const text: TextStyle = { fontFamily: font, fontSize: size, lineHeight: size * 1.18, color };
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}
      accessible
      accessibilityLabel={label ?? value}
      accessibilityRole="text"
    >
      {[...value].map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <View key={i} style={{ width: size * DIGIT_EM * scale, alignItems: 'center' }}>
            <Text style={text} maxFontSizeMultiplier={maxScale} importantForAccessibility="no">
              {ch}
            </Text>
          </View>
        ) : (
          <Text key={i} style={text} maxFontSizeMultiplier={maxScale} importantForAccessibility="no">
            {ch}
          </Text>
        )
      )}
    </View>
  );
}
