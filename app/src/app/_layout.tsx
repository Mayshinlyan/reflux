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
import { logger } from '@/lib/logger';
import { initSentry, Sentry } from '@/lib/sentry';
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
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: lightColors.bg },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default Sentry.wrap(RootLayout);

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
