import * as Haptics from 'expo-haptics';
import { Activity } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { AddSymptomsSheet } from '@/components/profile/AddSymptomsSheet';
import { Screen } from '@/components/Screen';
import { symptomLabel } from '@/components/SymptomZones';
import { zoneOfSymptom } from '@/constants/bodyZones';
import { SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { useSettings } from '@/db/DatabaseProvider';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { cardEdge, minTouchTarget, radius, space, typography, useColors } from '@/theme';

/**
 * Usual symptoms (Profile > Your lists, Figma row 25): only the symptoms you chose, as filled cards with their
 * body area underneath, laid out like Favorite foods and Medications. A tap opens one to remove it, and the Add
 * button at the bottom offers the symptoms that are not on the list yet. They are shown first when you log.
 */
export default function UsualSymptomsScreen() {
  const colors = useColors();
  const { settings, update } = useSettings();
  const [adding, setAdding] = useState(false);
  // Bumped on every open, so the add sheet starts with nothing picked (see the sheet's `key` note).
  const [opened, setOpened] = useState(0);
  const [viewing, setViewing] = useState<SymptomKey | null>(null);
  // What the sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [shown, setShown] = useState<SymptomKey | null>(null);

  // In catalog order, so the list doesn't depend on the order they were added.
  const usual = SYMPTOM_KEYS.filter((key) => settings.usualSymptoms.includes(key));

  const open = (key: SymptomKey) => {
    setShown(key);
    setViewing(key);
  };
  const remove = (key: SymptomKey) => {
    try {
      update(
        'usualSymptoms',
        settings.usualSymptoms.filter((item) => item !== key),
      );
    } catch (error) {
      logger.error('removeUsualSymptom', error);
      Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setViewing(null);
  };
  const add = () => {
    setOpened((count) => count + 1);
    setAdding(true);
  };

  return (
    <Screen style={styles.screen}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          Usual symptoms
        </AppText>
        {usual.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            No usual symptoms yet.
          </AppText>
        ) : (
          usual.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={symptomLabel(key)}
              onPress={() => open(key)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, ...cardEdge(colors), opacity: pressed ? 0.85 : 1 },
              ]}>
              <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
                <Activity size={20} color={colors.clayInk} strokeWidth={2} />
              </View>
              <View style={styles.text}>
                <AppText style={styles.name} numberOfLines={2}>
                  {symptomLabel(key)}
                </AppText>
                <AppText variant="caption" color="inkSoft">
                  {zoneOfSymptom(key)}
                </AppText>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Add a symptom" variant="secondary" onPress={add} />
      </View>

      <BottomSheet visible={viewing !== null} onClose={() => setViewing(null)}>
        {shown && (
          <>
            <AppText variant="section" accessibilityRole="header" style={styles.sheetTitle}>
              {symptomLabel(shown)}
            </AppText>
            <Button label="Remove" variant="quietDanger" onPress={() => remove(shown)} />
          </>
        )}
      </BottomSheet>
      <AddSymptomsSheet key={`add-${opened}`} visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { paddingBottom: space.s3 },
  // No instruction line under the title, so the title itself leaves the gap before the first card.
  title: { marginBottom: space.s4 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    minHeight: minTouchTarget,
    borderRadius: radius.lg,
    padding: space.s1,
    marginBottom: space.s1_5,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  name: typography.button,
  footer: { paddingTop: space.s2 },
  sheetTitle: { marginBottom: space.s1 },
});
