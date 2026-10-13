import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AddSymptomSheet } from '@/components/AddSymptomSheet';
import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useToast } from '@/components/Toast';
import { isCustomSymptom, symptomKeyFromText } from '@/constants/symptomItems';
import { useDb } from '@/db/DatabaseProvider';
import { createSavedSymptom, listSavedSymptoms, removeSavedSymptom } from '@/db/repositories/savedSymptoms';
import type { SavedSymptom } from '@/db/schema';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { radius, space, typography, useColors } from '@/theme';

/**
 * My symptoms (Settings > My symptoms, Figma 05c): the symptoms typed in "Add your own", as filled cards.
 * A left swipe removes one from the quick-pick chips; entries already logged keep it. There is no edit:
 * remove it and add it again.
 */
export default function MySymptomsScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const [symptoms, setSymptoms] = useState<SavedSymptom[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const reload = useCallback(() => {
    try {
      setSymptoms(listSavedSymptoms(db));
      setLoadFailed(false);
    } catch (error) {
      logger.error('listSavedSymptoms', error);
      setLoadFailed(true);
    }
  }, [db]);
  useFocusEffect(reload);

  const confirmRemove = (symptom: SavedSymptom) => {
    Alert.alert(`Remove ${symptom.name}?`, 'It leaves your list, but entries you already logged keep it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            removeSavedSymptom(db, symptom.id);
          } catch (error) {
            logger.error('removeSavedSymptom', error);
            Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
            return;
          }
          toast('Removed from your list');
          reload();
        },
      },
    ]);
  };

  const add = (text: string) => {
    // A name that is already a built-in symptom has its own chip, so it isn't added here.
    const key = symptomKeyFromText(text);
    if (key && !isCustomSymptom(key)) {
      setAddOpen(false);
      toast('That one is already in the list when you log');
      return;
    }
    try {
      createSavedSymptom(db, text);
    } catch (error) {
      logger.error('createSavedSymptom', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setAddOpen(false);
    reload();
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackHeader />
        <AppText variant="display" accessibilityRole="header">
          My symptoms
        </AppText>
        <AppText color="inkSoft" style={styles.subtitle}>
          Swipe left to remove one.
        </AppText>
        {loadFailed && symptoms.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            {`${friendlyMessages.INTERNAL} Your symptoms are still on this phone.`}
          </AppText>
        ) : symptoms.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            Symptoms you add with “Add your own” show up here.
          </AppText>
        ) : (
          symptoms.map((symptom) => (
            <SwipeToDelete
              key={symptom.id}
              label={symptom.name}
              style={styles.row}
              onDelete={() => confirmRemove(symptom)}>
              <View
                accessible
                accessibilityLabel={symptom.name}
                // Swiping isn't possible with a screen reader, so offer Delete from its actions menu.
                accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'delete') confirmRemove(symptom);
                }}
                style={[styles.card, { backgroundColor: colors.surface }]}>
                <AppText style={styles.name} numberOfLines={2}>
                  {symptom.name}
                </AppText>
              </View>
            </SwipeToDelete>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Add a symptom" variant="secondary" onPress={() => setAddOpen(true)} />
      </View>
      <AddSymptomSheet visible={addOpen} onClose={() => setAddOpen(false)} onAdd={add} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { paddingBottom: space.s3 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: space.s2, marginBottom: space.s4 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  // On the swipe container, not the card, so the revealed Delete button is exactly the card's height.
  row: { marginBottom: 12 },
  card: { borderRadius: radius.lg, minHeight: 48, paddingHorizontal: space.s2, justifyContent: 'center' },
  name: { ...typography.bodyEm, fontSize: 15, lineHeight: 20 },
  footer: { paddingTop: space.s2, paddingBottom: space.s3 },
});
