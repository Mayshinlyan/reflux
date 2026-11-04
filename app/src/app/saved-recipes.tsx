import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { RecipeRow } from '@/components/kitchen/RecipeRow';
import { Screen } from '@/components/Screen';
import { useDb } from '@/db/DatabaseProvider';
import { listSavedRecipes, type StoredRecipe } from '@/db/repositories/savedRecipes';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/** Every saved recipe in one list (Kitchen > Saved, Figma 38e). A tap opens the recipe, where it can also be removed. */
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
            <RecipeRow
              key={item.id}
              recipe={item.recipe}
              onPress={() => router.push({ pathname: '/recipe', params: { saved: String(item.id) } })}
            />
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
