import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ListCard } from '@/components/ListCard';
import { AddLifestyleSheet } from '@/components/profile/AddLifestyleSheet';
import { Screen } from '@/components/Screen';
import { useDb } from '@/db/DatabaseProvider';
import { listSavedSymptoms, removeSavedSymptom } from '@/db/repositories/savedSymptoms';
import type { SavedSymptom } from '@/db/schema';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Lifestyle (Profile > Your lists, Figma row 26): the lifestyle factors you added, as cards laid out like Usual
 * symptoms, Favorite foods and Medications. A tap opens one to remove it (entries already logged keep it), and the
 * Add button at the bottom adds another. Symptoms you typed yourself are on Usual symptoms.
 */
export default function LifestyleScreen() {
  const db = useDb();
  const [items, setItems] = useState<SavedSymptom[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [viewing, setViewing] = useState<SavedSymptom | null>(null);
  // What the sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [shown, setShown] = useState<SavedSymptom | null>(null);
  const [adding, setAdding] = useState(false);
  // Bumped on every open, so the add sheet starts with an empty field (see the sheet's `key` note).
  const [opened, setOpened] = useState(0);

  const reload = useCallback(() => {
    try {
      setItems(listSavedSymptoms(db, 'lifestyle'));
      setLoadFailed(false);
    } catch (error) {
      logger.error('listSavedSymptoms', error);
      setLoadFailed(true);
    }
  }, [db]);
  useFocusEffect(reload);

  const open = (item: SavedSymptom) => {
    setShown(item);
    setViewing(item);
  };
  const remove = (item: SavedSymptom) => {
    try {
      removeSavedSymptom(db, item.id);
    } catch (error) {
      logger.error('removeSavedSymptom', error);
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
          Lifestyle
        </AppText>
        {loadFailed && items.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            {`${friendlyMessages.INTERNAL} Your lifestyle list is still on this phone.`}
          </AppText>
        ) : items.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            No lifestyle yet.
          </AppText>
        ) : (
          items.map((item) => (
            <ListCard
              key={item.id}
              label={item.name}
              icon={Leaf}
              tint="clayTint"
              ink="clayInk"
              onPress={() => open(item)}
              onDelete={() => remove(item)}
            />
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Add a lifestyle" variant="secondary" onPress={add} />
      </View>

      <BottomSheet visible={viewing !== null} onClose={() => setViewing(null)}>
        {shown && (
          <>
            <AppText variant="section" accessibilityRole="header" style={styles.sheetTitle}>
              {shown.name}
            </AppText>
            <Button label="Remove" variant="quietDanger" onPress={() => remove(shown)} />
          </>
        )}
      </BottomSheet>
      <AddLifestyleSheet
        key={`add-${opened}`}
        visible={adding}
        onClose={() => setAdding(false)}
        onAdded={reload}
      />
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
