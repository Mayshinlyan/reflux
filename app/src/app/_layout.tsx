import { Gaegu_400Regular, Gaegu_700Bold } from '@expo-google-fonts/gaegu';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { preloadChing } from '@/lib/ching';
import { ToastProvider } from '@/components/Toast';
import { DatabaseProvider, useDb } from '@/db/DatabaseProvider';
import { onSavedFoodsChange } from '@/db/repositories/savedFoods';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { initSentry, wrapRoot } from '@/lib/sentry';
import { syncWidget } from '@/services/widgetSync';
import { lightColors, space } from '@/theme';

initSentry();
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Gaegu_400Regular,
    Gaegu_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) logger.error('loadFonts', fontError);
  }, [fontError]);

  if (!ready) return null;

  // The splash stays up until the database is open and migrated.
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <DatabaseProvider fallback={null} errorView={<DatabaseErrorScreen />}>
        <HideSplash />
        <WidgetSync />
        <ToastProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: lightColors.bg },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
          </Stack>
        </ToastProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

function HideSplash() {
  useEffect(() => {
    SplashScreen.hideAsync();
    preloadChing();
  }, []);
  return null;
}

/** Keeps the home-screen widget's saved foods current: filled when the app opens, refilled when My foods changes. */
function WidgetSync() {
  const db = useDb();
  useEffect(() => {
    const sync = () => void syncWidget(db);
    sync();
    onSavedFoodsChange(sync);
    return () => onSavedFoodsChange(null);
  }, [db]);
  return null;
}

function DatabaseErrorScreen() {
  return (
    <Screen>
      <HideSplash />
      <View style={styles.center}>
        <AppText variant="title" style={styles.gap}>
          Something went wrong
        </AppText>
        <AppText color="inkSoft">{friendlyMessages.DB_MIGRATION_FAILED}</AppText>
      </View>
    </Screen>
  );
}

export default wrapRoot(RootLayout);

/** Last-resort boundary; routes can export their own for finer-grained recovery. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('renderRoot', error);
  }, [error]);

  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="title" style={styles.gap}>
          Something went wrong
        </AppText>
        <AppText color="inkSoft" style={styles.gap}>
          Your logs are safe on your phone. Let&apos;s try that again.
        </AppText>
        <Button label="Try again" onPress={retry} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  gap: { marginBottom: space.s2 },
});
