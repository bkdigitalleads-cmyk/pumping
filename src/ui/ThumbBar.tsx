import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Theme } from '../theme';

/**
 * The bottom of the screen, just above the tab bar: where the main action
 * lives, so it is in reach of one thumb with a baby on the other arm.
 */
export default function ThumbBar({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <View style={[styles.bar, { backgroundColor: theme.bg, borderTopColor: theme.rule }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
