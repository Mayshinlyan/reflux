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
import { useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CheckInRouter } from '@/components/CheckInRouter';
import { Screen } from '@/components/Screen';
import { preloadChing } from '@/lib/ching';
import { ToastProvider } from '@/components/Toast';
import { DatabaseProvider, useDb } from '@/db/DatabaseProvider';
import { onSavedFoodsChange } from '@/db/repositories/savedFoods';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { initSentry, wrapRoot } from '@/lib/sentry';
import { setupReminders } from '@/services/reminders';
import { syncWidget } from '@/services/widgetSync';
import { lightColors, space } from '@/theme';

initSentry();
setupReminders();
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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (fontError) logger.error('loadFonts', fontError);
  }, [fontError]);

  if (!ready) return null;

  // The splash stays up until the database is open and migrated.
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <DatabaseProvider fallback={null} errorView={(retry) => <DatabaseErrorScreen onRetry={retry} />}>
        <HideSplash />
        <WidgetSync />
        <ToastProvider>
          {/* Drill-downs (Entry, Edit, My additions, Favorite foods) push from the side and swipe back from the
              edge. Logging slides up as a modal and closes with a swipe down. Tabs and Welcome only cross-fade. */}
          <Stack
            screenOptions={{
              headerShown: false,
              animation: reduceMotion ? 'none' : 'default',
              contentStyle: { backgroundColor: lightColors.bg },
            }}>
            <Stack.Screen name="(tabs)" options={{ animation: reduceMotion ? 'none' : 'fade' }} />
            <Stack.Screen
              name="welcome"
              options={{ gestureEnabled: false, animation: reduceMotion ? 'none' : 'fade' }}
            />
            <Stack.Screen name="log/index" options={{ presentation: 'modal' }} />
            <Stack.Screen
              name="log/food"
              options={({ route }) => ({
                // Favorite foods is a list you drill into, not a log.
                presentation:
                  (route.params as { manage?: string } | undefined)?.manage === '1' ? 'card' : 'modal',
              })}
            />
            <Stack.Screen name="log/symptoms" options={{ presentation: 'modal' }} />
            <Stack.Screen name="log/medication" options={{ presentation: 'modal' }} />
          </Stack>
          <CheckInRouter />
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

/** Keeps the home-screen widget's saved foods current: filled when the app opens, refilled when Favorite foods changes. */
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

function DatabaseErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen>
      <HideSplash />
      <View style={styles.center}>
        <AppText variant="title" style={styles.gap}>
          Something went wrong
        </AppText>
        <AppText color="inkSoft" style={styles.gap}>
          {friendlyMessages.DB_MIGRATION_FAILED}
        </AppText>
        <Button label="Try again" onPress={onRetry} />
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
