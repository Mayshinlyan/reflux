import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { FloatingTabBar, type TabKey } from '@/components/FloatingTabBar';
import { type LogKind, QuickLogArch } from '@/components/QuickLogArch';
import { lightColors } from '@/theme';

/** Which route each tab opens, and the reverse. Log is an action, so it has no route here. */
const ROUTE_FOR: Record<Exclude<TabKey, 'log'>, string> = {
  today: 'index',
  history: 'history',
};
const TAB_FOR: Record<string, Exclude<TabKey, 'log'>> = {
  index: 'today',
  history: 'history',
};

/** Where each button on the quick log arch goes. Food opens the camera straight away. */
const openLog = (kind: LogKind) => {
  if (kind === 'food') router.push({ pathname: '/log/food', params: { camera: '1' } });
  else router.push(kind === 'symptoms' ? '/log/symptoms' : '/log/medication');
};

/** Adapts the router's tab state to the Figma tab bar, with the quick log arch opening over the screen. */
function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const active = TAB_FOR[state.routes[state.index]?.name ?? 'index'] ?? 'today';
  const [logOpen, setLogOpen] = useState(false);

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
      {logOpen && (
        <QuickLogArch
          bottomInset={insets.bottom}
          onClose={() => setLogOpen(false)}
          onPick={(kind) => {
            setLogOpen(false);
            openLog(kind);
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
              setLogOpen((open) => !open);
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
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: lightColors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
