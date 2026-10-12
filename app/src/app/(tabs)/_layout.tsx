import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { FloatingTabBar, type TabKey, tabBarBottomOffset } from '@/components/FloatingTabBar';
import { lightColors } from '@/theme';

/** Which route each tab opens, and the reverse. Log is an action, so it has no route here. */
const ROUTE_FOR: Record<Exclude<TabKey, 'log'>, string> = {
  today: 'index',
  history: 'history',
  you: 'settings',
};
const TAB_FOR: Record<string, Exclude<TabKey, 'log'>> = {
  index: 'today',
  history: 'history',
  settings: 'you',
};

/** Adapts the router's tab state to the Figma floating bar, hovering over the screens. */
function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const active = TAB_FOR[state.routes[state.index]?.name ?? 'index'] ?? 'today';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: tabBarBottomOffset(insets.bottom) }]}>
      <FloatingTabBar
        active={active}
        onSelect={(tab) => {
          if (tab === 'log') router.push('/log');
          else if (tab !== active) navigation.navigate(ROUTE_FOR[tab]);
        }}
      />
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
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24 },
});
