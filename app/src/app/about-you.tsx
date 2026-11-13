import { router, useFocusEffect } from 'expo-router';
import { Ban, Leaf, Pill, Stethoscope, Thermometer, Utensils } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { AboutTile } from '@/components/profile/AboutTile';
import { ConditionSheet } from '@/components/profile/ConditionSheet';
import { Screen } from '@/components/Screen';
import { LIFESTYLE_TAGS } from '@/constants/lifestyleTags';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listAvoidFoods } from '@/db/repositories/avoidFoods';
import { listMedications } from '@/db/repositories/medications';
import { listSavedFoods } from '@/db/repositories/savedFoods';
import { listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/** One wording for every tile: how many, then "added". */
const count = (n: number) => (n === 0 ? 'None yet' : `${n} added`);

/**
 * About you (Figma G6b): the six lists Bellie uses to read your meals, as big tiles with how many are in each. It
 * replaces the six rows that used to sit on Profile. Condition is a sheet; the rest open their own pages.
 */
export default function AboutYouScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const [counts, setCounts] = useState({ own: 0, foods: 0, avoid: 0, meds: 0, lifestyle: 0 });
  const [conditionOpen, setConditionOpen] = useState(false);
  // Bumped on every open, so the sheet starts fresh from the saved values (see the sheets' `key` note).
  const [opened, setOpened] = useState(0);

  const reload = useCallback(() => {
    try {
      setCounts({
        own: listSavedSymptoms(db, 'symptom').length,
        foods: listSavedFoods(db).length,
        avoid: listAvoidFoods(db).length,
        meds: listMedications(db).length,
        lifestyle: listSavedSymptoms(db, 'lifestyle').length,
      });
    } catch (error) {
      // The tiles still open; they just show no counts.
      logger.error('aboutYouCounts', error);
    }
  }, [db]);
  useFocusEffect(reload);

  const conditions = settings.conditions.filter((condition) => condition !== 'unsure').length;

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
              count={count(conditions)}
              onPress={() => {
                setOpened((n) => n + 1);
                setConditionOpen(true);
              }}
            />
            <AboutTile
              icon={Thermometer}
              tone="honey"
              label="Usual symptoms"
              count={count(settings.usualSymptoms.length + counts.own)}
              onPress={() => router.push('/usual-symptoms')}
            />
          </View>
          <View style={styles.pair}>
            <AboutTile
              icon={Utensils}
              tone="rose"
              label="Favorite foods"
              count={count(counts.foods)}
              onPress={() => router.push({ pathname: '/log/food', params: { manage: '1' } })}
            />
            <AboutTile
              icon={Ban}
              tone="clay"
              label="Foods to avoid"
              count={count(counts.avoid)}
              onPress={() => router.push('/avoid-foods')}
            />
          </View>
          <View style={styles.pair}>
            <AboutTile
              icon={Pill}
              tone="sky"
              label="Medications"
              count={count(counts.meds)}
              onPress={() => router.push({ pathname: '/log/medication', params: { manage: '1' } })}
            />
            <AboutTile
              icon={Leaf}
              tone="mint"
              label="Lifestyle factors"
              count={count(LIFESTYLE_TAGS.length + counts.lifestyle)}
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
