import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFonts } from 'expo-font';
import { useTheme, fonts, FONT_FILES } from './src/theme';
import Icon, { IconName } from './src/icons';
import { AppProvider, useApp, ONBOARDED_KEY, FREE_SESSION_LIMIT } from './src/state';
import { countSessions, kvGet, kvSet } from './src/db';
import TodayScreen from './src/screens/Today';
import StashScreen from './src/screens/Stash';
import TrendsScreen from './src/screens/Trends';
import SettingsScreen from './src/screens/Settings';
import SessionModal, { SessionMode } from './src/screens/Session';
import PaywallModal from './src/screens/Paywall';
import Onboarding from './src/screens/Onboarding';
import Welcome, { TrialSteps } from './src/screens/Welcome';
import { maybeRequestReviewOnLaunch } from './src/reviews';
import { softTap } from './src/ui/motion';
import { PRIVACY_URL } from './src/links';

type Tab = 'today' | 'stash' | 'trends' | 'settings';

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'drop' },
  { key: 'stash', label: 'Stash', icon: 'bag' },
  { key: 'trends', label: 'Trends', icon: 'chart' },
  { key: 'settings', label: 'Settings', icon: 'sliders' },
];

function Shell() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, isPro, showPaywall, paywallVisible, active, startSession, notice } = useApp();
  const [tab, setTab] = useState<Tab>('today');
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // New installs: value screens, setup questions, trial and reminder screens, then the paywall.
  const [step, setStep] = useState<'welcome' | 'setup' | 'trial' | 'paywall'>('welcome');
  const paywallOpened = useRef(false);
  const [session, setSession] = useState<{ mode: SessionMode; id: number | null } | null>(null);

  useEffect(() => {
    if (!ready || onboarded !== null) return;
    (async () => {
      if ((await kvGet(ONBOARDED_KEY)) === '1') return setOnboarded(true);
      // Anyone who already has sessions, or is Pro, has used the app: no onboarding.
      if (isPro || (await countSessions()) > 0) {
        kvSet(ONBOARDED_KEY, '1').catch(() => {});
        return setOnboarded(true);
      }
      setOnboarded(false);
    })().catch(() => setOnboarded(true)); // fail open: never trap the user
  }, [ready, onboarded, isPro]);

  const openOnboardingPaywall = () => {
    if (paywallOpened.current) return;
    paywallOpened.current = true;
    setStep('paywall');
    showPaywall();
  };

  const finishOnboarding = () => {
    setOnboarded(true);
    kvSet(ONBOARDED_KEY, '1').catch(() => {});
  };

  // When the onboarding paywall closes (purchase or close button), onboarding is done.
  useEffect(() => {
    if (paywallOpened.current && !paywallVisible && onboarded === false) finishOnboarding();
  }, [paywallVisible, onboarded]);

  // The screen stays awake while a session runs, on Today as well as in the session itself.
  const running = active != null;
  // A gentle tap at 15 and 20 minutes into a session, once each, for anyone timing by feel.
  const startedAt = active?.startedAt ?? 0;
  useEffect(() => {
    if (!startedAt) return;
    const done = new Set<number>();
    const t = setInterval(() => {
      const min = (Date.now() - startedAt) / 60_000;
      for (const m of [15, 20]) {
        if (min >= m && min < m + 0.5 && !done.has(m)) {
          done.add(m);
          softTap();
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [startedAt]);
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync('session').catch(() => {});
    return () => {
      deactivateKeepAwake('session').catch(() => {});
    };
  }, [running]);

  /** New sessions stop at the free limit; a session already running can always be finished. */
  const canLogNew = async () => isPro || (await countSessions()) < FREE_SESSION_LIMIT;

  const onStart = async () => {
    if (!active) {
      if (!(await canLogNew())) return showPaywall();
      await startSession();
    }
    setSession({ mode: 'live', id: null });
  };

  const onLogPast = async () => {
    if (!(await canLogNew())) return showPaywall();
    setSession({ mode: 'past', id: null });
  };

  const onOpenSession = (id: number) => setSession({ mode: 'edit', id });

  if (!ready || onboarded === null) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  if (!onboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
        {step === 'welcome' && <Welcome onDone={() => setStep('setup')} />}
        {step === 'setup' && <Onboarding onDone={() => setStep('trial')} />}
        {step === 'trial' && <TrialSteps onDone={openOnboardingPaywall} />}
        <PaywallModal privacyUrl={PRIVACY_URL} onboarding />
      </View>
    );
  }

  return (
    <>
      <LaunchReview />
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
        <View style={{ flex: 1 }}>
          {tab === 'today' && (
            <TodayScreen
              onStart={onStart}
              onLogPast={onLogPast}
              onOpenSession={onOpenSession}
              onOpenSettings={() => setTab('settings')}
            />
          )}
          {tab === 'stash' && <StashScreen />}
          {tab === 'trends' && <TrendsScreen onOpenSession={onOpenSession} />}
          {tab === 'settings' && <SettingsScreen />}
        </View>
        {notice && (
          <View style={[styles.notice, { backgroundColor: theme.ink }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text style={[styles.noticeText, { color: theme.bg }]}>{notice}</Text>
          </View>
        )}
        <View style={[styles.tabBar, { backgroundColor: theme.bg, borderTopColor: theme.rule, paddingBottom: Math.max(insets.bottom, 8) }]}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={styles.tabItem}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.label}
              >
                <Icon name={t.icon} size={24} color={on ? theme.ink : theme.inkFaint} strokeWidth={on ? 2.2 : 1.7} />
                <Text style={[styles.tabLabel, { color: on ? theme.ink : theme.inkFaint }]} maxFontSizeMultiplier={1.3}>
                  {t.label}
                </Text>
                <View style={[styles.tabMark, { backgroundColor: on ? theme.accent : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>
        <SessionModal
          visible={session != null}
          mode={session?.mode ?? 'live'}
          sessionId={session?.id ?? null}
          onClose={() => setSession(null)}
        />
        <PaywallModal privacyUrl={PRIVACY_URL} />
      </View>
    </>
  );
}

/** Once per launch, from the main screen: the "later calendar day" rating trigger. */
function LaunchReview() {
  useEffect(() => {
    maybeRequestReviewOnLaunch();
  }, []);
  return null;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Square-edged, like the lists: a hairline on top and a short accent bar under the open tab.
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', gap: 3, minHeight: 50, justifyContent: 'center' },
  tabLabel: { fontSize: 11, fontWeight: fonts.weight.semibold, letterSpacing: 0.3 },
  tabMark: { width: 18, height: 2, marginTop: 2 },
  notice: { paddingHorizontal: 20, paddingVertical: 14 },
  noticeText: { fontSize: 16, fontWeight: fonts.weight.semibold, lineHeight: 21 },
});
