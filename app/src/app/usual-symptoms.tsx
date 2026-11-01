import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Activity } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ListCard } from '@/components/ListCard';
import { AddSymptomsSheet } from '@/components/profile/AddSymptomsSheet';
import { Screen } from '@/components/Screen';
import { symptomLabel } from '@/components/SymptomZones';
import { BODY_ZONES, OTHER_AREA_LABEL, zoneOfSymptom } from '@/constants/bodyZones';
import { SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listSavedSymptoms, removeSavedSymptom } from '@/db/repositories/savedSymptoms';
import type { SavedSymptom } from '@/db/schema';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/** What a card opens: a built-in symptom you chose, or one you typed yourself. */
type Item = { own: false; key: SymptomKey } | { own: true; row: SavedSymptom };

const areaOf = (row: SavedSymptom) =>
  BODY_ZONES.find((zone) => zone.key === row.zone)?.label ?? OTHER_AREA_LABEL;

/**
 * Usual symptoms (Profile > Your lists, Figma rows 25 and 26): the symptoms you chose, then the ones you typed
 * yourself, as filled cards with their body area underneath, laid out like Favorite foods and Medications. A tap
 * opens one to remove it, and the Add button at the bottom offers the built-in symptoms that are not on the list
 * yet. Usual ones are shown first when you log; the ones you typed are added where you log.
 */
export default function UsualSymptomsScreen() {
  const db = useDb();
  const { settings, update } = useSettings();
  const [own, setOwn] = useState<SavedSymptom[]>([]);
  const [adding, setAdding] = useState(false);
  // Bumped on every open, so the add sheet starts with nothing picked (see the sheet's `key` note).
  const [opened, setOpened] = useState(0);
  const [viewing, setViewing] = useState<Item | null>(null);
  // What the sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [shown, setShown] = useState<Item | null>(null);

  const reload = useCallback(() => {
    try {
      setOwn(listSavedSymptoms(db, 'symptom'));
    } catch (error) {
      logger.error('listSavedSymptoms', error);
    }
  }, [db]);
  useFocusEffect(reload);

  // In catalog order, so the list doesn't depend on the order they were added.
  const usual = SYMPTOM_KEYS.filter((key) => settings.usualSymptoms.includes(key));

  const open = (item: Item) => {
    setShown(item);
    setViewing(item);
  };
  const remove = (item: Item) => {
    try {
      if (item.own) removeSavedSymptom(db, item.row.id);
      else
        update(
          'usualSymptoms',
          settings.usualSymptoms.filter((key) => key !== item.key),
        );
    } catch (error) {
      logger.error('removeUsualSymptom', error);
      Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setViewing(null);
    reload();
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
        {usual.length === 0 && own.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            No usual symptoms yet.
          </AppText>
        ) : (
          <>
            {usual.map((key) => (
              <ListCard
                key={key}
                label={symptomLabel(key)}
                caption={zoneOfSymptom(key)}
                icon={Activity}
                tint="clayTint"
                ink="clayInk"
                onPress={() => open({ own: false, key })}
              />
            ))}
            {own.map((row) => (
              <ListCard
                key={`own-${row.id}`}
                label={row.name}
                caption={areaOf(row)}
                icon={Activity}
                tint="clayTint"
                ink="clayInk"
                onPress={() => open({ own: true, row })}
              />
            ))}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Add a symptom" variant="secondary" onPress={add} />
      </View>

      <BottomSheet visible={viewing !== null} onClose={() => setViewing(null)}>
        {shown && (
          <>
            <AppText variant="section" accessibilityRole="header" style={styles.sheetTitle}>
              {shown.own ? shown.row.name : symptomLabel(shown.key)}
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
  footer: { paddingTop: space.s2 },
  sheetTitle: { marginBottom: space.s1 },
});
