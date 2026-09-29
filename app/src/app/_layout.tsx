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

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ToastProvider } from '@/components/Toast';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { initSentry, wrapRoot } from '@/lib/sentry';
import { lightColors, space } from '@/theme';

initSentry();
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
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
    <>
      <StatusBar style="dark" />
      <DatabaseProvider fallback={null} errorView={<DatabaseErrorScreen />}>
        <HideSplash />
        <ToastProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: lightColors.bg },
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
          </Stack>
        </ToastProvider>
      </DatabaseProvider>
    </>
  );
}

function HideSplash() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
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
  center: { flex: 1, justifyContent: 'center' },
  gap: { marginBottom: space.s2 },
});
