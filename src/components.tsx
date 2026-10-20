import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Theme, fonts } from './theme';
import Icon, { IconName } from './icons';

export function Card({ theme, children, style }: { theme: Theme; children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>;
}

export function PillButton({
  theme,
  label,
  onPress,
  kind = 'primary',
  big = false,
  icon,
  disabled = false,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost';
  /** The one big action on a screen: taller, larger label. */
  big?: boolean;
  icon?: IconName;
  disabled?: boolean;
}) {
  const bg = kind === 'primary' ? theme.accent : 'transparent';
  const fg = kind === 'primary' ? theme.onAccent : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pill,
        big && styles.pillBig,
        {
          backgroundColor: bg,
          borderColor: theme.accent,
          borderWidth: kind === 'ghost' ? 1.5 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon && <Icon name={icon} size={big ? 24 : 20} color={fg} strokeWidth={2.2} />}
      <Text style={[styles.pillLabel, big && styles.pillLabelBig, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{children}</Text>;
}

export function ProBadge({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.proBadge, { backgroundColor: theme.accentSoft }]}>
      <Text style={[styles.proBadgeText, { color: theme.accent }]}>PRO</Text>
    </View>
  );
}

/** A round + or - button that repeats while held. */
export function StepButton({
  theme,
  dir,
  onStep,
  size = 64,
  label,
  disabled = false,
}: {
  theme: Theme;
  dir: 1 | -1;
  onStep: (dir: 1 | -1) => void;
  size?: number;
  label: string;
  disabled?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // The latest callback, so a held button keeps stepping from the current value.
  const step = useRef(onStep);
  step.current = onStep;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onStep(dir);
      }}
      onLongPress={() => {
        stop();
        timer.current = setInterval(() => step.current(dir), 120);
      }}
      onPressOut={stop}
      delayLongPress={350}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? theme.accent : theme.accentSoft,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {({ pressed }) => (
        <Icon
          name={dir > 0 ? 'plus' : 'minus'}
          size={size * 0.42}
          color={pressed ? theme.onAccent : theme.accent}
          strokeWidth={2.6}
        />
      )}
    </Pressable>
  );
}

/**
 * A big value between - and + buttons, for one-thumb use. The value itself is
 * a text field too, for typing a number instead of tapping.
 */
export function Stepper({
  theme,
  label,
  valueText,
  unit,
  onStep,
  onTyped,
  color,
  size = 'big',
}: {
  theme: Theme;
  label: string;
  /** The number as shown, in the user's unit. */
  valueText: string;
  unit?: string;
  onStep: (dir: 1 | -1) => void;
  /** Typed text; the parent parses it. Omit to make the value read-only. */
  onTyped?: (text: string) => void;
  color?: string;
  size?: 'big' | 'small';
}) {
  const big = size === 'big';
  const [text, setText] = useState(valueText);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(valueText);
  }, [valueText, editing]);
  const commit = () => {
    setEditing(false);
    onTyped?.(text);
  };
  const valueStyle = [big ? styles.stepValueBig : styles.stepValueSmall, { color: color ?? theme.text }];
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepLabel, { color: color ?? theme.textSecondary }]}>{label}</Text>
      <View style={styles.stepRow}>
        <StepButton theme={theme} dir={-1} onStep={onStep} size={big ? 64 : 48} label={`Less ${label.toLowerCase()}`} />
        <View style={styles.stepValueWrap}>
          {onTyped ? (
            <TextInput
              style={valueStyle}
              value={text}
              onChangeText={setText}
              onFocus={() => setEditing(true)}
              onBlur={commit}
              onSubmitEditing={commit}
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus
              maxLength={6}
              accessibilityLabel={`${label}, ${valueText} ${unit ?? ''}`}
            />
          ) : (
            <Text style={valueStyle}>{valueText}</Text>
          )}
          {unit ? <Text style={[styles.stepUnit, { color: theme.textFaint }]}>{unit}</Text> : null}
        </View>
        <StepButton theme={theme} dir={1} onStep={onStep} size={big ? 64 : 48} label={`More ${label.toLowerCase()}`} />
      </View>
    </View>
  );
}

/** Two to four choices in a row, one selected. */
export function Segmented<T extends string>({
  theme,
  options,
  value,
  onChange,
}: {
  theme: Theme;
  options: { value: T; label: string; badge?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: theme.cardAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segmentItem, on && { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.segmentText, { color: on ? theme.text : theme.textSecondary }]}>{o.label}</Text>
            {o.badge}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable settings row: label left, value or chevron right. */
export function Row({
  theme,
  label,
  value,
  onPress,
  danger = false,
  right,
}: {
  theme: Theme;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row} accessibilityRole={onPress ? 'button' : undefined}>
      <Text style={[styles.rowText, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
      {right ?? (
        <View style={styles.rowRight}>
          {value ? <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text> : null}
          {onPress && !danger ? <Icon name="chevronRight" size={16} color={theme.textFaint} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Text field that reports only on blur or submit, so clearing it to retype never saves a wrong value. */
export function CommitField({
  value,
  onCommit,
  style,
  placeholder,
  placeholderTextColor,
}: {
  value: string;
  onCommit: (text: string) => void;
  style?: TextStyle | TextStyle[];
  placeholder?: string;
  placeholderTextColor?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <TextInput
      style={style}
      value={text}
      onChangeText={setText}
      onBlur={() => onCommit(text)}
      onSubmitEditing={() => onCommit(text)}
      keyboardType="decimal-pad"
      returnKeyType="done"
      maxLength={6}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      selectTextOnFocus
    />
  );
}

/** Round icon on a soft tile, used at the top of onboarding screens and empty states. */
export function IconTile({ theme, icon, size = 64 }: { theme: Theme; icon: IconName; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.5} color={theme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  pill: {
    borderRadius: 30,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  pillBig: { minHeight: 68, borderRadius: 34 },
  pillLabel: { fontSize: 17, fontWeight: fonts.weight.semibold },
  pillLabelBig: { fontSize: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: fonts.weight.semibold,
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 28,
    marginLeft: 4,
  },
  proBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  proBadgeText: { fontSize: 10, fontWeight: fonts.weight.bold, letterSpacing: 0.5 },
  stepper: { alignItems: 'center', gap: 6 },
  stepLabel: { fontSize: 14, fontWeight: fonts.weight.semibold, letterSpacing: 0.4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // Fixed widths, so a typed value never pushes the - and + buttons off the row.
  stepValueWrap: { width: 112, alignItems: 'center' },
  stepValueBig: { fontFamily: fonts.display, fontSize: 46, lineHeight: 54, textAlign: 'center', width: 112, padding: 0 },
  stepValueSmall: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, textAlign: 'center', width: 112, padding: 0 },
  stepUnit: { fontSize: 13, marginTop: -2 },
  segment: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentText: { fontSize: 15, fontWeight: fonts.weight.semibold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  rowText: { fontSize: 16, flexShrink: 1 },
  rowValue: { fontSize: 16 },
});
