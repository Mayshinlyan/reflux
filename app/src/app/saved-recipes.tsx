import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { RecipeRow } from '@/components/kitchen/RecipeRow';
import { Screen } from '@/components/Screen';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useDb } from '@/db/DatabaseProvider';
import { listSavedRecipes, removeSavedRecipe, type StoredRecipe } from '@/db/repositories/savedRecipes';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Every saved recipe in one list (Kitchen > Saved, Figma 38e). A tap opens the recipe; a swipe left (or the Delete
 * action for a screen reader) asks first, then removes it.
 */
export default function SavedRecipesScreen() {
  const db = useDb();
  const [saved, setSaved] = useState<StoredRecipe[]>([]);

  const reload = useCallback(() => {
    try {
      setSaved(listSavedRecipes(db));
    } catch (error) {
      logger.error('listSavedRecipes', error);
    }
  }, [db]);
  useFocusEffect(reload);

  const confirmRemove = (item: StoredRecipe) => {
    Alert.alert(`Remove ${item.recipe.title}?`, 'It leaves your saved recipes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            removeSavedRecipe(db, item.id);
          } catch (error) {
            logger.error('removeSavedRecipe', error);
            Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
            return;
          }
          reload();
        },
      },
    ]);
  };

  return (
    <Screen style={styles.screen}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            Saved recipes
          </AppText>
          <AppText variant="voiceSmall" color="inkSoft">
            {saved.length === 1 ? '1 recipe' : `${saved.length} recipes`}
          </AppText>
        </View>
        {saved.length === 0 ? (
          <AppText variant="subtitle" color="inkMuted">
            Recipes you save will show up here.
          </AppText>
        ) : (
          saved.map((item) => (
            <SwipeToDelete key={item.id} label={item.recipe.title} onDelete={() => confirmRemove(item)}>
              <RecipeRow
                recipe={item.recipe}
                onPress={() => router.push({ pathname: '/recipe', params: { saved: String(item.id) } })}
                onDelete={() => confirmRemove(item)}
              />
            </SwipeToDelete>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { paddingBottom: space.s3, gap: space.s1 + 4 },
  heading: { gap: space.s1, marginBottom: space.s2 },
});
