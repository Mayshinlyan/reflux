import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { cleanFoodName, MAX_FOOD_NAME, parseWanted } from '@/lib/recipe';
import { minTouchTarget, radius, space, useColors } from '@/theme';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has finished closing, so what follows (the wait) never opens under a closing sheet. */
  onDismissed: () => void;
};

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        hitSlop={(minTouchTarget - 36) / 2}
        style={[styles.close, { backgroundColor: colors.surface }]}>
        <X size={18} color={colors.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/**
 * Swap one ingredient (Figma 31e): Bellie picks a gentle swap, or you type your own. One button does both, so there is
 * nothing to choose between: it says "Let Bellie pick" until something is typed.
 */
export function SwapSheet({
  ingredient,
  onSubmit,
  ...sheet
}: SheetProps & { ingredient: string; onSubmit: (replacement: string | undefined) => void }) {
  const [text, setText] = useState('');
  const replacement = cleanFoodName(text);
  return (
    <BottomSheet visible={sheet.visible} onClose={sheet.onClose} onDismissed={sheet.onDismissed}>
      <Header title="Swap this ingredient" onClose={sheet.onClose} />
      <View style={styles.body}>
        <AppText color="inkSoft">{ingredient}</AppText>
        <TextField
          label="Or choose your own"
          placeholder="Something else, like cabbage"
          value={text}
          onChangeText={setText}
          maxLength={MAX_FOOD_NAME}
          returnKeyType="done"
          onSubmitEditing={() => onSubmit(replacement || undefined)}
        />
        <Button
          label={replacement ? `Swap for ${replacement}` : 'Let Bellie pick'}
          onPress={() => onSubmit(replacement || undefined)}
        />
      </View>
    </BottomSheet>
  );
}

/** Add ingredients (Figma 31f): type one or a few, separated by commas. The photo of the fridge comes in a later release. */
export function AddIngredientsSheet({
  onSubmit,
  ...sheet
}: SheetProps & { onSubmit: (ingredients: string[]) => void }) {
  const [text, setText] = useState('');
  const wanted = parseWanted(text);
  return (
    <BottomSheet visible={sheet.visible} onClose={sheet.onClose} onDismissed={sheet.onDismissed}>
      <Header title="Add ingredients" onClose={sheet.onClose} />
      <View style={styles.body}>
        <TextField
          label="Type one or a few"
          placeholder="Like zucchini, tofu"
          value={text}
          onChangeText={setText}
          returnKeyType="done"
          onSubmitEditing={() => wanted.length > 0 && onSubmit(wanted)}
        />
        <Button label="Update my recipe" disabled={wanted.length === 0} onPress={() => onSubmit(wanted)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  title: { flex: 1 },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  body: { gap: space.s2 },
});
