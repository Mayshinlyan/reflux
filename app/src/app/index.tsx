import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

/**
 * Today — the pet-hero home screen. Skeleton placeholder until Step 6 builds the pet;
 * Step 2 adds the redirect to /welcome when onboarding hasn't been completed.
 */
export default function TodayScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          How&apos;s your throat today?
        </AppText>
        <AppText color="inkSoft">Buddy is on the way.</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { marginBottom: space.s1, textAlign: 'center' },
});
