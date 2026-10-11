import { router } from 'expo-router';
import { Activity, Pill, Utensils, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ChoiceCard } from '@/components/ChoiceCard';
import { Screen } from '@/components/Screen';
import { TopBar, TopBarButton } from '@/components/TopBar';
import { space } from '@/theme';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Log: choose a type (Figma "03a"). Opened from the Log tab; each card replaces this screen with its flow. */
export default function LogChooseScreen() {
  return (
    <Screen>
      <TopBar hideBack right={<TopBarButton icon={X} label="Close" onPress={close} />} />
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        What would you like to log?
      </AppText>
      <View style={styles.options}>
        <ChoiceCard
          title="Food"
          subtitle="A photo or a quick description"
          icon={Utensils}
          onPress={() => router.replace('/log/food')}
        />
        <ChoiceCard
          title="Symptoms"
          subtitle="How you're feeling right now"
          icon={Activity}
          onPress={() => router.replace('/log/symptoms')}
        />
        <ChoiceCard
          title="Medication"
          subtitle="A dose you've taken"
          icon={Pill}
          onPress={() => router.replace('/log/medication')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.s2, marginBottom: space.s3 },
  options: { gap: 12 },
});
