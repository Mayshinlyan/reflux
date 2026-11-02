import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Ban } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ListCard } from '@/components/ListCard';
import { AddAvoidSheet } from '@/components/profile/AddAvoidSheet';
import { Screen } from '@/components/Screen';
import { useDb } from '@/db/DatabaseProvider';
import { listAvoidFoods, removeAvoidFood } from '@/db/repositories/avoidFoods';
import type { AvoidFood } from '@/db/schema';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * I don't eat (Profile > Your lists, Figma row 29h): foods you never eat, an allergy or a diet, as cards laid out
 * like Favorite foods, Usual symptoms and Lifestyle. The Kitchen keeps every one of them out of its recipes. A tap
 * opens one to remove it, and the Add button at the bottom adds another.
 */
export default function AvoidFoodsScreen() {
  const db = useDb();
  const [items, setItems] = useState<AvoidFood[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [viewing, setViewing] = useState<AvoidFood | null>(null);
  // What the sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [shown, setShown] = useState<AvoidFood | null>(null);
  const [adding, setAdding] = useState(false);
  // Bumped on every open, so the add sheet starts with an empty field (see the sheet's `key` note).
  const [opened, setOpened] = useState(0);

  const reload = useCallback(() => {
    try {
      setItems(listAvoidFoods(db));
      setLoadFailed(false);
    } catch (error) {
      logger.error('listAvoidFoods', error);
      setLoadFailed(true);
    }
  }, [db]);
  useFocusEffect(reload);

  const open = (item: AvoidFood) => {
    setShown(item);
    setViewing(item);
  };
  const remove = (item: AvoidFood) => {
    try {
      removeAvoidFood(db, item.id);
    } catch (error) {
      logger.error('removeAvoidFood', error);
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
          I don&apos;t eat
        </AppText>
        {loadFailed && items.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            {`${friendlyMessages.INTERNAL} Your list is still on this phone.`}
          </AppText>
        ) : items.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            Nothing yet. Add foods you never eat and the Kitchen will keep them out of every recipe.
          </AppText>
        ) : (
          items.map((item) => (
            <ListCard
              key={item.id}
              label={item.name}
              icon={Ban}
              tint="honeyTint"
              ink="honeyInk"
              onPress={() => open(item)}
            />
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Add a food" variant="secondary" onPress={add} />
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
      <AddAvoidSheet
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
