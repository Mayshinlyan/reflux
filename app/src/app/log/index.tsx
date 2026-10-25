import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LogTile } from '@/components/LogTile';
import { Screen } from '@/components/Screen';
import { TopBar, TopBarButton } from '@/components/TopBar';
import { LOG_KINDS, type LogKind } from '@/lib/logKinds';
import { space } from '@/theme';

const ROUTE: Record<LogKind, '/log/food' | '/log/symptoms' | '/log/medication'> = {
  food: '/log/food',
  symptoms: '/log/symptoms',
  medication: '/log/medication',
};

const withDate = (pathname: (typeof ROUTE)[LogKind], date?: string) =>
  date ? { pathname, params: { date } } : pathname;

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Log: choose a type (Figma "03a"). Opened from the belly, the Log button or a day in the week strip; each
 * big tile replaces this screen with its flow, so closing that flow returns to where you were. A `date` from
 * the week strip is handed on to each flow, which logs for that day.
 */
export default function LogChooseScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return (
    <Screen>
      <TopBar hideBack right={<TopBarButton icon={X} label="Close" onPress={close} />} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          What would you like to log?
        </AppText>
        <View style={styles.tiles}>
          {LOG_KINDS.map(({ kind, label, icon, tint }) => (
            <LogTile
              key={kind}
              label={label}
              icon={icon}
              tint={tint}
              onPress={() => router.replace(withDate(ROUTE[kind], date))}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.s4 + space.s1, marginBottom: space.s4 + space.s1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s3 },
});
