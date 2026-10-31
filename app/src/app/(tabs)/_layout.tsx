import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FloatingTabBar, type TabKey } from '@/components/FloatingTabBar';
import { type LogKind, QuickLogArch } from '@/components/QuickLogArch';
import { TourProvider } from '@/components/tour/TourContext';
import { closeLogArch, openLogArch, useLogArch } from '@/lib/logArch';
import { lightColors } from '@/theme';

/** Which route each tab opens, and the reverse. Log is an action, so it has no route here. */
const ROUTE_FOR: Record<Exclude<TabKey, 'log'>, string> = {
  today: 'index',
  history: 'history',
  profile: 'profile',
  settings: 'settings',
};
const TAB_FOR: Record<string, Exclude<TabKey, 'log'>> = {
  index: 'today',
  history: 'history',
  profile: 'profile',
  settings: 'settings',
};

/**
 * Where each button on the quick log arch goes. Log food opens the Food screen (type it, add a photo, or tap a
 * saved food), not straight to the camera. The arch opens from the + button, from Bellie, and from a day in
 * Today's week strip, which hands its day on to the screen.
 */
const LOG_ROUTE: Record<LogKind, '/log/food' | '/log/symptoms' | '/log/medication'> = {
  food: '/log/food',
  symptoms: '/log/symptoms',
  medication: '/log/medication',
};

/** Adapts the router's tab state to the Figma tab bar, with the quick log arch opening over the screen. */
function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const active = TAB_FOR[state.routes[state.index]?.name ?? 'index'] ?? 'today';
  const { open: logOpen, date: logDate } = useLogArch();
  // The arch stays mounted until its close animation ends; `logOpen` is only where it is headed.
  const [archShown, setArchShown] = useState(false);
  const hideArch = useCallback(() => setArchShown(false), []);
  // Opened from anywhere (the + button, Bellie, a day in the week strip), it is drawn from that render on. This is
  // state derived during render, not an effect, so the arch never appears a frame late.
  if (logOpen && !archShown) setArchShown(true);

  // The store outlives this bar: if the bar goes (a reset to Welcome), the arch must not come back open.
  useEffect(() => closeLogArch, []);

  // The Android back button closes the arch first.
  useEffect(() => {
    if (!logOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeLogArch();
      return true;
    });
    return () => subscription.remove();
  }, [logOpen]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {archShown && (
        <QuickLogArch
          bottomInset={insets.bottom}
          open={logOpen}
          onClosed={hideArch}
          onClose={closeLogArch}
          onPick={(kind) => {
            closeLogArch();
            router.push(logDate ? { pathname: LOG_ROUTE[kind], params: { date: logDate } } : LOG_ROUTE[kind]);
          }}
        />
      )}
      <View pointerEvents="box-none" style={styles.wrap}>
        <FloatingTabBar
          active={active}
          logOpen={logOpen}
          bottomInset={insets.bottom}
          onSelect={(tab) => {
            if (tab === 'log') {
              if (logOpen) closeLogArch();
              else openLogArch();
              return;
            }
            closeLogArch();
            // `navigateToTab` takes the route's key, which isn't its name.
            const target = state.routes.find((route) => route.name === ROUTE_FOR[tab]);
            if (tab !== active && target) navigateToTab(target.key);
          }}
        />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const reduceMotion = useReducedMotion();
  return (
    // The app tour is drawn over the tabs and their bar.
    <TourProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? 'none' : 'fade',
          sceneStyle: { backgroundColor: lightColors.bg },
        }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </TourProvider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
