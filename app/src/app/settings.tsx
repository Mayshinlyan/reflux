import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { space } from '@/theme';

/** Settings ("Profile" in the mockup). Bedtime, medications and the rest arrive in Step 4. */
export default function SettingsScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title="Profile" />
        <SectionTitle first>Activity</SectionTitle>
        <SettingsRow label="History" onPress={() => router.push('/history')} />
        <AppText variant="caption" color="inkSoft" style={styles.note}>
          Bedtime, your medications, your pet and privacy settings are coming next.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s4 },
  note: { marginTop: space.s2 },
});
