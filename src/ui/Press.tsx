import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Theme, fonts, radius } from '../theme';
import Icon, { IconName } from '../icons';

/** Anything tappable: always shows it was pressed. */
export function Press({
  style,
  pressedStyle,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && (pressedStyle ?? { opacity: 0.6 })]}>
      {children}
    </Pressable>
  );
}

/**
 * The one shape for a thumb action: a full pill. `loud` is the clay (day) or
 * dim amber (night) fill; `quiet` sits a shade below the page.
 */
export function PillAction({
  theme,
  label,
  onPress,
  icon,
  quiet = false,
  tall = false,
  disabled = false,
  hint,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  icon?: IconName;
  quiet?: boolean;
  tall?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const fg = quiet ? theme.ink : theme.onAccent;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={[
        styles.pill,
        tall && styles.tall,
        { backgroundColor: quiet ? theme.sunk : theme.accent, opacity: disabled ? 0.45 : 1 },
      ]}
      pressedStyle={{ opacity: 0.82, transform: [{ scale: 0.985 }] }}
    >
      {icon && <Icon name={icon} size={tall ? 24 : 20} color={fg} strokeWidth={2.2} />}
      <Text style={[styles.label, tall && styles.labelTall, { color: fg }]} maxFontSizeMultiplier={1.5} numberOfLines={2}>
        {label}
      </Text>
    </Press>
  );
}

/** A word you can tap, in the accent color. At least 44 points tall. */
export function TextAction({
  theme,
  label,
  onPress,
  color,
  icon,
  align = 'flex-start',
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  color?: string;
  icon?: IconName;
  align?: 'flex-start' | 'center' | 'flex-end';
}) {
  const c = color ?? theme.accent;
  return (
    <Press onPress={onPress} accessibilityRole="button" hitSlop={8} style={[styles.text, { alignSelf: align }]}>
      {icon && <Icon name={icon} size={18} color={c} />}
      <Text style={[styles.textLabel, { color: c }]}>{label}</Text>
    </Press>
  );
}

/** A round icon button (minus, plus, close). */
export function RoundButton({
  theme,
  icon,
  onPress,
  label,
  size = 44,
  filled = false,
  disabled = false,
  repeat,
}: {
  theme: Theme;
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
  /** From useRepeat, for hold-to-repeat. */
  repeat?: { onPress: () => void; onLongPress: () => void; onPressOut: () => void; delayLongPress: number };
}) {
  return (
    <Press
      onPress={repeat?.onPress ?? onPress}
      onLongPress={repeat?.onLongPress}
      onPressOut={repeat?.onPressOut}
      delayLongPress={repeat?.delayLongPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? theme.sunk : 'transparent',
        borderWidth: filled ? 0 : StyleSheet.hairlineWidth * 2,
        borderColor: theme.rule,
        opacity: disabled ? 0.35 : 1,
      }}
      pressedStyle={{ backgroundColor: theme.accentSoft }}
    >
      <Icon name={icon} size={size * 0.44} color={theme.ink} strokeWidth={2.2} />
    </Press>
  );
}

/** The header strip of a sheet: an action each side, the title in the middle, square-edged. */
export function SheetHeader({
  theme,
  title,
  left,
  right,
  top = 0,
}: {
  theme: Theme;
  title: string;
  left?: { label: string; onPress: () => void };
  right?: { label: string; onPress: () => void; strong?: boolean };
  top?: number;
}) {
  return (
    <View style={[styles.header, { paddingTop: top + 12, borderBottomColor: theme.rule }]}>
      <View style={styles.headerSide}>
        {left && (
          <Press onPress={left.onPress} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.headerBtn, { color: theme.inkSoft }]}>{left.label}</Text>
          </Press>
        )}
      </View>
      <Text style={[styles.headerTitle, { color: theme.ink }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
        {right && (
          <Press onPress={right.onPress} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.headerBtn, { color: theme.accent, fontWeight: right.strong ? '700' : '500' }]}>{right.label}</Text>
          </Press>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tall: { minHeight: 66 },
  label: { fontSize: 17, fontWeight: fonts.weight.semibold },
  labelTall: { fontSize: 19 },
  text: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  textLabel: { fontSize: 16, fontWeight: fonts.weight.semibold },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { flex: 1 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, textAlign: 'center', flex: 2 },
  headerBtn: { fontSize: 17 },
});
