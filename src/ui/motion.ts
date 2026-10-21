import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';

/** True while iOS Reduce Motion is on: fills and slides then jump straight to the end. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const softTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/**
 * Tap to step once; hold to repeat, getting faster the longer you hold
 * (350 ms between steps at first, down to 60 ms). Each step ticks.
 */
export function useRepeat(step: () => void) {
  const latest = useRef(step);
  latest.current = step;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const run = (delay: number) => {
    timer.current = setTimeout(() => {
      latest.current();
      tick();
      run(Math.max(60, delay * 0.8));
    }, delay);
  };
  return {
    onPress: () => {
      latest.current();
      tick();
    },
    onLongPress: () => {
      stop();
      latest.current();
      tick();
      run(300);
    },
    onPressOut: stop,
    delayLongPress: 380,
  };
}
