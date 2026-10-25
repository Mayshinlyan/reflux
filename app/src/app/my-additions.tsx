import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Screen } from '@/components/Screen';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useToast } from '@/components/Toast';
import { useDb } from '@/db/DatabaseProvider';
import { listSavedSymptoms, removeSavedSymptom } from '@/db/repositories/savedSymptoms';
import type { SavedSymptom } from '@/db/schema';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { radius, space, typography, useColors } from '@/theme';

/**
 * Symptoms and lifestyles (Profile > Your lists, Figma 05c): the symptoms and lifestyle factors typed with a "+" chip,
 * as filled cards with their kind underneath. A left swipe removes one from the quick-pick chips; entries
 * already logged keep it. Adding happens where you log, so there is no add button and no edit.
 */
export default function MyAdditionsScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const [symptoms, setSymptoms] = useState<SavedSymptom[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

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

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackHeader />
        <AppText variant="display" accessibilityRole="header">
          Symptoms and lifestyles
        </AppText>
        <AppText color="inkSoft" style={styles.subtitle}>
          Swipe left to remove one.
        </AppText>
        {loadFailed && symptoms.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            {`${friendlyMessages.INTERNAL} Your additions are still on this phone.`}
          </AppText>
        ) : symptoms.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            Symptoms and lifestyle factors you add with + show up here.
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
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.edge },
                ]}>
                <AppText style={styles.name} numberOfLines={2}>
                  {symptom.name}
                </AppText>
                <AppText variant="caption" color="inkSoft">
                  {symptom.kind === 'lifestyle' ? 'Lifestyle' : 'Symptom'}
                </AppText>
              </View>
            </SwipeToDelete>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { paddingBottom: space.s3 },
  subtitle: { ...typography.subtitle, marginTop: space.s2, marginBottom: space.s4 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  // On the swipe container, not the card, so the revealed Delete button is exactly the card's height.
  row: { marginBottom: space.s1_5 },
  card: {
    borderRadius: radius.lg,
    minHeight: 56,
    paddingHorizontal: space.s2,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  name: { ...typography.button, fontFamily: typography.bodyEm.fontFamily },
});
