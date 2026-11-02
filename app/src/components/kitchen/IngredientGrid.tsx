import { Plus, Repeat, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { type LayoutRectangle, Pressable, StyleSheet, View } from 'react-native';

import { ActionMenu } from '@/components/ActionMenu';
import { AppText } from '@/components/AppText';
import { stepTone } from '@/lib/recipeSteps';
import { minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  ingredients: readonly string[];
  onSwap: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
};

const MENU_WIDTH = 232;
/** The menu sits just under the card it belongs to, tucked in a little so they read as one. */
const MENU_OVERLAP = 6;

/**
 * The ingredients as small cards in two columns with a "+ Add" tile (Figma 31c). Tapping a card opens a small menu
 * under it: Swap or Remove (Figma 31d). Each card has a soft coloured dot, taken in turn.
 */
export function IngredientGrid({ ingredients, onSwap, onRemove, onAdd }: Props) {
  const colors = useColors();
  const [menu, setMenu] = useState<number | null>(null);
  const [cards, setCards] = useState<Record<number, LayoutRectangle>>({});
  const [width, setWidth] = useState(0);

  const choose = (action: (index: number) => void) => () => {
    const index = menu;
    setMenu(null);
    if (index !== null) action(index);
  };

  // A card is always measured before it can be tapped; the fallback only keeps the menu from vanishing if it was not.
  const anchor = menu === null ? undefined : (cards[menu] ?? { x: 0, y: 0, width: 0, height: 0 });
  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {ingredients.map((item, index) => {
        const open = menu === index;
        return (
          <Pressable
            key={`${item}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={item}
            accessibilityHint="Opens Swap and Remove"
            accessibilityState={{ expanded: open }}
            onPress={() => setMenu(open ? null : index)}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              setCards((current) => ({ ...current, [index]: layout }));
            }}
            style={[styles.card, { backgroundColor: open ? colors.sageTint : colors.surface2 }]}>
            <View style={[styles.dot, { backgroundColor: colors[stepTone(index).tint] }]} />
            <AppText variant="subtitle" style={styles.text}>
              {item}
            </AppText>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add an ingredient"
        onPress={() => {
          setMenu(null);
          onAdd();
        }}
        style={[styles.card, styles.add, { backgroundColor: colors.sageTint }]}>
        <Plus size={20} color={colors.sageInk} strokeWidth={2} />
        <AppText variant="bodyEm" color="sageInk">
          Add
        </AppText>
      </Pressable>

      {anchor && menu !== null && (
        <View
          style={[
            styles.menu,
            {
              top: anchor.y + anchor.height - MENU_OVERLAP,
              left: Math.max(0, Math.min(anchor.x, width - MENU_WIDTH)),
            },
          ]}>
          <ActionMenu
            items={[
              { label: 'Swap', icon: Repeat, onPress: choose(onSwap) },
              { label: 'Remove', icon: Trash2, destructive: true, onPress: choose(onRemove) },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 + 4 },
  // Two to a row, with the gap between them.
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1 + 4,
    paddingHorizontal: space.s1 + 4,
    paddingVertical: space.s1,
    borderRadius: radius.md,
  },
  dot: { width: 28, height: 28, borderRadius: radius.pill },
  text: { flex: 1 },
  add: { flexGrow: 0, flexBasis: '47%', justifyContent: 'center' },
  menu: { position: 'absolute', zIndex: 2 },
});
