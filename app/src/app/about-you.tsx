import { router } from 'expo-router';
import { Ban, Leaf, Pill, Stethoscope, Thermometer, Utensils } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { AboutTile } from '@/components/profile/AboutTile';
import { ConditionSheet } from '@/components/profile/ConditionSheet';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

/**
 * About you (Figma G6b): the six lists Bellie uses to read your meals, as big tiles, an icon and a name each. It
 * replaces the six rows that used to sit on Profile. Condition is a sheet; the rest open their own pages.
 */
export default function AboutYouScreen() {
  const [conditionOpen, setConditionOpen] = useState(false);
  // Bumped on every open, so the sheet starts fresh from the saved values (see the sheets' `key` note).
  const [opened, setOpened] = useState(0);

  return (
    <Screen>
      <BackHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          About you
        </AppText>
        <AppText color="inkSoft" style={styles.sub}>
          What Bellie uses to read your meals
        </AppText>
        <View style={styles.grid}>
          <View style={styles.pair}>
            <AboutTile
              icon={Stethoscope}
              tone="lavender"
              label="Condition"
              onPress={() => {
                setOpened((n) => n + 1);
                setConditionOpen(true);
              }}
            />
            <AboutTile
              icon={Thermometer}
              tone="honey"
              label="Usual symptoms"
              onPress={() => router.push('/usual-symptoms')}
            />
          </View>
          <View style={styles.pair}>
            <AboutTile
              icon={Utensils}
              tone="rose"
              label="Favorite foods"
              onPress={() => router.push({ pathname: '/log/food', params: { manage: '1' } })}
            />
            <AboutTile
              icon={Ban}
              tone="clay"
              label="Foods to avoid"
              onPress={() => router.push('/avoid-foods')}
            />
          </View>
          <View style={styles.pair}>
            <AboutTile
              icon={Pill}
              tone="sky"
              label="Medications"
              onPress={() => router.push({ pathname: '/log/medication', params: { manage: '1' } })}
            />
            <AboutTile
              icon={Leaf}
              tone="mint"
              label="Lifestyle factors"
              onPress={() => router.push('/lifestyle')}
            />
          </View>
        </View>
      </ScrollView>
      <ConditionSheet
        key={`condition-${opened}`}
        visible={conditionOpen}
        onClose={() => setConditionOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s4 },
  sub: { marginTop: space.s1, marginBottom: space.s3 },
  grid: { gap: space.s2 },
  pair: { flexDirection: 'row', gap: space.s2 },
});
