import { router, useLocalSearchParams } from 'expo-router';
import { Activity, Pill, Utensils, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LogTile } from '@/components/LogTile';
import { Screen } from '@/components/Screen';
import { TopBar, TopBarButton } from '@/components/TopBar';
import { space } from '@/theme';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Log: choose a type (Figma "03a"). Opened from the belly, the Log button or a day in the week strip; each
 * big tile replaces this screen with its flow, so closing that flow returns to where you were. A `date` from
 * the week strip is handed on to Symptoms; Food and Medication have their own "when" pickers.
 */
export default function LogChooseScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return (
    <Screen>
      <TopBar hideBack right={<TopBarButton icon={X} label="Close" onPress={close} />} />
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        What would you like to log?
      </AppText>
      <View style={styles.tiles}>
        <View style={styles.row}>
          <LogTile
            label="Food"
            icon={Utensils}
            tint="honeyTint"
            onPress={() => router.replace('/log/food')}
          />
          <LogTile
            label="Symptoms"
            icon={Activity}
            tint="clayTint"
            onPress={() =>
              router.replace(date ? { pathname: '/log/symptoms', params: { date } } : '/log/symptoms')
            }
          />
        </View>
        <View style={styles.row}>
          <LogTile
            label="Medication"
            icon={Pill}
            tint="sageTint"
            onPress={() => router.replace('/log/medication')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.s2, marginBottom: space.s3 },
  tiles: { gap: space.s3, alignItems: 'center' },
  row: { flexDirection: 'row', gap: space.s3 },
});
