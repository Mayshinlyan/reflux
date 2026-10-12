import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { FloatingTabBar, type TabKey } from '@/components/FloatingTabBar';
import { type LogKind, QuickLogArch } from '@/components/QuickLogArch';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { pickFoodPhoto } from '@/services/photoPicker';
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

/**
 * Snap food opens the camera from here, so the Food screen is not pushed (and seen behind the camera) first. A
 * photo opens the Food screen on its review step; closing the camera leaves you where you were. Without camera
 * access the Food screen opens and asks again, so it can say why.
 */
async function snapFood() {
  try {
    const picked = await pickFoodPhoto('camera');
    if (picked.status === 'ok')
      router.push({ pathname: '/log/food', params: { photoUri: picked.photo.uri } });
    else if (picked.status === 'denied') router.push({ pathname: '/log/food', params: { camera: '1' } });
  } catch {
    // Code only: the picker or manipulator error could carry file paths.
    logger.error('snapFood', new AppError('INPUT_REJECTED'));
    router.push('/log/food');
  }
}

/** Where each button on the quick log arch goes. */
const openLog = (kind: LogKind, snap: () => void) => {
  if (kind === 'food') snap();
  else router.push(kind === 'symptoms' ? '/log/symptoms' : '/log/medication');
};

/** Adapts the router's tab state to the Figma tab bar, with the quick log arch opening over the screen. */
function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const active = TAB_FOR[state.routes[state.index]?.name ?? 'index'] ?? 'today';
  const [logOpen, setLogOpen] = useState(false);
  const snapping = useRef(false);
  // One camera at a time: a second tap while it is open (or its photo is being prepared) is ignored.
  const snap = () => {
    if (snapping.current) return;
    snapping.current = true;
    void snapFood().finally(() => {
      snapping.current = false;
    });
  };

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
            openLog(kind, snap);
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
