import { Heart } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { FoodSuggestion } from '@/lib/foodSuggestions';
import { fontFamily, minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  suggestions: FoodSuggestion[];
  onPick: (suggestion: FoodSuggestion) => void;
};

/**
 * Figma row 20: the foods matching what is being typed, in a surface card right under "Describe it". The typed part
 * is bold; a favorite has a clay heart and logs at once, the others fill the field.
 */
export function FoodSuggestions({ suggestions, onPick }: Props) {
  const colors = useColors();
  const count = suggestions.length;
  const announced = useRef(0);
  useEffect(() => {
    // Say how many there are when the list appears or changes size, not on every letter.
    if (count > 0 && count !== announced.current) {
      AccessibilityInfo.announceForAccessibility(`${count} ${count === 1 ? 'suggestion' : 'suggestions'}`);
    }
    announced.current = count;
  }, [count]);

  if (count === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {suggestions.map((item, index) => {
        const end = item.matchStart + item.matchLength;
        const favorite = item.source === 'favorite';
        return (
          <Pressable
            key={`${item.source}:${item.name}`}
            accessibilityRole="button"
            accessibilityLabel={favorite ? `${item.name}, favorite, logs now` : item.name}
            onPress={() => onPick(item)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <AppText variant="small" style={styles.name} numberOfLines={1}>
              {item.name.slice(0, item.matchStart)}
              <AppText variant="small" style={styles.match}>
                {item.name.slice(item.matchStart, end)}
              </AppText>
              {item.name.slice(end)}
            </AppText>
            {favorite && <Heart size={16} color={colors.clay} fill={colors.clay} strokeWidth={2} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Rows are 44 high (the touch minimum), 16 in from the card edge, like the Figma "Suggestion row".
  card: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
  },
  name: { flex: 1 },
  match: { fontFamily: fontFamily.bold },
});
