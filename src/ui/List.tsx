import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Theme, fonts } from '../theme';
import Icon from '../icons';
import Figures from './Figures';
import { Press, RoundButton } from './Press';
import { useRepeat } from './motion';

/**
 * Lists are square-edged and full-bleed: a Fraunces heading, then rows split
 * by hairlines. No boxes around groups.
 */
export function Section({
  theme,
  title,
  note,
  children,
  first = false,
}: {
  theme: Theme;
  title?: string;
  note?: string;
  children?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <View style={{ paddingTop: first ? 8 : 34 }}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.ink }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {note ? <Text style={[styles.sectionNote, { color: theme.inkSoft }]}>{note}</Text> : null}
      <View style={[styles.sectionBody, { borderTopColor: theme.rule }]}>{children}</View>
    </View>
  );
}

/** One row: a label (and an optional line under it) on the left, anything on the right. */
export function Entry({
  theme,
  label,
  sub,
  value,
  onPress,
  danger = false,
  children,
  chevron,
  a11yLabel,
}: {
  theme: Theme;
  label: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  children?: React.ReactNode;
  chevron?: boolean;
  a11yLabel?: string;
}) {
  const body = (
    <>
      <View style={{ flex: 1, paddingVertical: 12 }}>
        <Text style={[styles.entryLabel, { color: danger ? theme.danger : theme.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.entrySub, { color: theme.inkFaint }]}>{sub}</Text> : null}
      </View>
      {value ? <Text style={[styles.entryValue, { color: theme.inkSoft }]}>{value}</Text> : null}
      {children}
      {(chevron ?? (onPress && !danger)) ? <Icon name="chevronRight" size={16} color={theme.inkFaint} /> : null}
    </>
  );
  const rowStyle = [styles.entry, { borderBottomColor: theme.rule }];
  return onPress ? (
    <Press
      onPress={onPress}
      style={rowStyle}
      pressedStyle={{ backgroundColor: theme.sunk }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? (value ? `${label}, ${value}` : label)}
    >
      {body}
    </Press>
  ) : (
    <View style={rowStyle} accessible={!children} accessibilityLabel={a11yLabel}>
      {body}
    </View>
  );
}

/** A row with an on/off switch. The thumb is dimmed at night (iOS draws it pure white otherwise). */
export function ToggleEntry({
  theme,
  label,
  sub,
  value,
  onChange,
}: {
  theme: Theme;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Entry theme={theme} label={label} sub={sub}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accent, false: theme.rule }}
        thumbColor={theme.thumb}
        ios_backgroundColor={theme.rule}
        accessibilityLabel={label}
      />
    </Entry>
  );
}

/**
 * A number you nudge: minus, the value, plus. Hold to repeat. With `onTyped`
 * the value can be tapped and typed instead.
 */
export function Nudge({
  theme,
  label,
  sub,
  value,
  unit,
  onStep,
  onTyped,
}: {
  theme: Theme;
  label: string;
  sub?: string;
  value: string;
  unit?: string;
  onStep: (dir: 1 | -1) => void;
  onTyped?: (text: string) => void;
}) {
  const down = useRepeat(() => onStep(-1));
  const up = useRepeat(() => onStep(1));
  const [typing, setTyping] = useState<string | null>(null);
  const commit = () => {
    if (typing != null) onTyped?.(typing);
    setTyping(null);
  };
  return (
    <Entry theme={theme} label={label} sub={sub} a11yLabel={`${label}, ${value} ${unit ?? ''}`}>
      <View style={styles.nudge}>
        <RoundButton theme={theme} icon="minus" label={`Less, ${label}`} onPress={() => onStep(-1)} repeat={down} />
        <View style={styles.nudgeValue}>
          {typing != null ? (
            <TextInput
              autoFocus
              style={[styles.nudgeInput, { color: theme.ink, borderBottomColor: theme.accent }]}
              value={typing}
              onChangeText={setTyping}
              onBlur={commit}
              onSubmitEditing={commit}
              keyboardType="decimal-pad"
              returnKeyType="done"
              maxLength={6}
              selectTextOnFocus
              accessibilityLabel={`Type ${label}`}
            />
          ) : (
            <Press
              onPress={() => onTyped && setTyping(value.replace('½', '.5'))}
              disabled={!onTyped}
              accessibilityRole={onTyped ? 'button' : 'text'}
              accessibilityLabel={`${value} ${unit ?? ''}${onTyped ? ', tap to type' : ''}`}
            >
              <Figures value={value} size={24} color={theme.ink} />
            </Press>
          )}
          {unit ? <Text style={[styles.nudgeUnit, { color: theme.inkFaint }]}>{unit}</Text> : null}
        </View>
        <RoundButton theme={theme} icon="plus" label={`More, ${label}`} onPress={() => onStep(1)} repeat={up} />
      </View>
    </Entry>
  );
}

/**
 * Choices as words with a marker underline under the chosen one, instead
 * of a segmented control.
 */
export function Tabs<T extends string>({
  theme,
  options,
  value,
  onChange,
  inset = 20,
  gap = 22,
}: {
  theme: Theme;
  options: { value: T; label: string; tag?: string }[];
  value: T;
  onChange: (v: T) => void;
  inset?: number;
  gap?: number;
}) {
  return (
    <View style={[styles.tabs, { paddingHorizontal: inset, columnGap: gap }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Press
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.tag ? `${o.label}, ${o.tag}` : o.label}
            style={styles.tab}
          >
            <View style={styles.tabRow}>
              <Text style={[styles.tabText, { color: on ? theme.ink : theme.inkSoft }]}>{o.label}</Text>
              {o.tag ? <Text style={[styles.tabTag, { color: theme.accent }]}>{o.tag}</Text> : null}
            </View>
            <Svg width="100%" height={8} viewBox="0 0 100 8" preserveAspectRatio="none" style={[styles.underline, { opacity: on ? 1 : 0 }]}>
              <Path d="M2 5 C 20 2, 35 7, 52 4.5 S 85 2.5, 98 5" stroke={theme.accent} strokeWidth={2.6} fill="none" strokeLinecap="round" />
            </Svg>
          </Press>
        );
      })}
    </View>
  );
}

/** A thin rule, full width. */
export function Hairline({ theme, inset = 0 }: { theme: Theme; inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.rule, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: fonts.heading, fontSize: 21, paddingHorizontal: 20, marginBottom: 4 },
  sectionNote: { fontSize: 15, lineHeight: 21, paddingHorizontal: 20, marginBottom: 6 },
  sectionBody: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryLabel: { fontSize: 17 },
  entrySub: { fontSize: 14, marginTop: 2, lineHeight: 19 },
  entryValue: { fontSize: 16, flexShrink: 1, textAlign: 'right' },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nudgeValue: { minWidth: 72, alignItems: 'center' },
  nudgeInput: { fontFamily: fonts.display, fontSize: 24, minWidth: 64, textAlign: 'center', borderBottomWidth: 2, padding: 0 },
  nudgeUnit: { fontSize: 12, marginTop: -2 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 4 },
  tab: { minHeight: 44, justifyContent: 'center', paddingBottom: 6 },
  underline: { position: 'absolute', left: 0, right: 0, bottom: 2 },
  tabRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  tabText: { fontSize: 17, fontWeight: fonts.weight.semibold },
  tabTag: { fontSize: 11, fontWeight: fonts.weight.bold, letterSpacing: 0.4 },
});
