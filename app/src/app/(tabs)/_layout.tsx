import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FloatingTabBar, type TabKey } from '@/components/FloatingTabBar';
import { type LogKind, QuickLogArch } from '@/components/QuickLogArch';
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
 * Where each button on the quick log arch goes. Log food opens the same Food screen as tapping Bellie on Today
 * (type it, add a photo, or tap a saved food), not straight to the camera.
 */
const LOG_ROUTE: Record<LogKind, '/log/food' | '/log/symptoms' | '/log/medication'> = {
  food: '/log/food',
  symptoms: '/log/symptoms',
  medication: '/log/medication',
};

/** Adapts the router's tab state to the Figma tab bar, with the quick log arch opening over the screen. */
function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const active = TAB_FOR[state.routes[state.index]?.name ?? 'index'] ?? 'today';
  const [logOpen, setLogOpen] = useState(false);
  // The arch stays mounted until its close animation ends; `logOpen` is only where it is headed.
  const [archShown, setArchShown] = useState(false);
  const hideArch = useCallback(() => setArchShown(false), []);

  // The Android back button closes the arch first.
  useEffect(() => {
    if (!logOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setLogOpen(false);
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
          onClose={() => setLogOpen(false)}
          onPick={(kind) => {
            setLogOpen(false);
            router.push(LOG_ROUTE[kind]);
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
              if (!logOpen) setArchShown(true);
              setLogOpen(!logOpen);
              return;
            }
            setLogOpen(false);
            if (tab !== active) navigation.navigate(ROUTE_FOR[tab]);
          }}
        />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const reduceMotion = useReducedMotion();
  return (
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
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
