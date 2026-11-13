import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { FoodSuggestions } from '@/components/food/FoodSuggestions';
import { TextField } from '@/components/TextField';
import { type LoggedSymptomKey, MAX_CUSTOM_SYMPTOM, symptomKeyFromText } from '@/constants/symptomItems';
import { type FoodSuggestion, suggestFoods } from '@/lib/foodSuggestions';
import { suggestSymptoms } from '@/lib/symptomSuggestions';
import { symptomLabel } from '@/lib/timeline';
import { cardEdge, fontFamily, minTouchTarget, radius, space, useColors } from '@/theme';

type Sources = Parameters<typeof suggestFoods>[1];

type SheetProps = { visible: boolean; onClose: () => void };

const MAX_FOOD_TEXT = 40;

/** Starts the text over with `initial` each time the sheet opens, so a half-typed fix is never kept. */
function useSheetText(visible: boolean, initial: string) {
  const [text, setText] = useState(initial);
  const [seen, setSeen] = useState(visible);
  if (visible !== seen) {
    setSeen(visible);
    if (visible) setText(initial);
  }
  return [text, setText] as const;
}

/** Figma 45h: fix one food by typing. Matching foods sit below, like the "Not quite right?" sheet. */
export function FixFoodSheet({
  visible,
  onClose,
  initial,
  sources,
  onUpdate,
  onRemove,
}: SheetProps & {
  initial: string;
  sources: Sources;
  onUpdate: (text: string) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useSheetText(visible, initial);
  const trimmed = text.trim();
  return (
    <BottomSheet visible={visible} onClose={onClose} tone="bg">
      <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
        Fix this food
      </AppText>
      <TextField
        label="Food"
        hideLabel
        value={text}
        onChangeText={setText}
        maxLength={MAX_FOOD_TEXT}
        placeholder="e.g. Red wine"
      />
      <FoodSuggestions
        suggestions={suggestFoods(trimmed, sources)}
        onPick={(item: FoodSuggestion) => setText(item.name)}
        favoritesLogNow={false}
      />
      <View style={styles.actions}>
        <Button label="Update" onPress={() => onUpdate(trimmed)} disabled={!trimmed} />
        <Button variant="quiet" label="Remove this food" onPress={onRemove} />
      </View>
    </BottomSheet>
  );
}

/**
 * Figma 45i: fix one symptom by typing. Matching symptoms sit below; a built-in name picks that symptom, anything
 * else becomes the user's own. There is no severity to change, because symptoms are only logged as felt.
 */
export function FixSymptomSheet({
  visible,
  onClose,
  current,
  ownLabels,
  onUpdate,
  onRemove,
}: SheetProps & {
  current: LoggedSymptomKey;
  ownLabels: readonly string[];
  onUpdate: (key: LoggedSymptomKey) => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const [text, setText] = useSheetText(visible, symptomLabel(current));
  const key = symptomKeyFromText(text);
  const suggestions = suggestSymptoms(text, ownLabels);
  return (
    <BottomSheet visible={visible} onClose={onClose} tone="bg">
      <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
        Fix this symptom
      </AppText>
      <TextField
        label="Symptom"
        hideLabel
        value={text}
        onChangeText={setText}
        maxLength={MAX_CUSTOM_SYMPTOM}
        placeholder="e.g. Heartburn"
      />
      {suggestions.length > 0 && (
        <View style={[styles.list, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          {suggestions.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => setText(item.label)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
                { opacity: pressed ? 0.7 : 1 },
              ]}>
              <AppText variant="small" numberOfLines={1}>
                {item.label.slice(0, item.matchStart)}
                <AppText variant="small" style={styles.match}>
                  {item.label.slice(item.matchStart, item.matchStart + item.matchLength)}
                </AppText>
                {item.label.slice(item.matchStart + item.matchLength)}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.actions}>
        <Button label="Update" onPress={() => key && onUpdate(key)} disabled={!key} />
        <Button variant="quiet" label="Remove this symptom" onPress={onRemove} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s2 },
  list: { borderRadius: radius.lg, overflow: 'hidden', marginTop: space.s1 },
  row: { minHeight: minTouchTarget, justifyContent: 'center', paddingHorizontal: space.s2 },
  match: { fontFamily: fontFamily.bold },
  actions: { marginTop: space.s2, gap: space.s1 },
});
