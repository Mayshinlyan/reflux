import { Leaf, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { CarouselDots } from '@/components/CarouselDots';
import { FoodLoading } from '@/components/FoodLoading';
import { cuisineLabel, type CuisineKey } from '@/constants/cuisines';
import type { ErrorCode } from '@/lib/errors';
import { ideasErrorMessage } from '@/lib/kitchenCopy';
import { recipeMeta } from '@/lib/recipe';
import { minTouchTarget, radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

import { CuisineArt } from './CuisineArt';

export type IdeasStatus = 'loading' | 'ready' | 'error';

type Props = {
  status: IdeasStatus;
  cuisine: CuisineKey;
  recipes: readonly Recipe[];
  errorCode?: ErrorCode;
  /** False once today's rounds are used up, so there is no "Generate more". */
  canMore: boolean;
  onStop: () => void;
  onClose: () => void;
  onCook: (recipe: Recipe) => void;
  onMore: () => void;
  onRetry: () => void;
};

const CARD_GAP = 12;
/** How much of the next card shows beside the current one, so it is clear there are more to swipe to. */
const PEEK = 32;

/**
 * What the ideas sheet holds after "Get ideas" (Figma row 29c, 29d, 29l): the wait with the existing pot loader, then
 * three cards to swipe with the dots under them and "Generate more", or a short note when it did not work.
 */
export function IdeasPanel({
  status,
  cuisine,
  recipes,
  errorCode,
  canMore,
  onStop,
  onClose,
  onCook,
  onMore,
  onRetry,
}: Props) {
  const colors = useColors();
  // The cuisine names the ideas while they are made and shown; a failed round has none, so it is plainly "Recipe ideas".
  const title =
    status === 'error'
      ? 'Recipe ideas'
      : cuisine === 'any'
        ? 'Ideas for you'
        : `${cuisineLabel(cuisine)} ideas`;
  return (
    <View>
      <View style={styles.header}>
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {status === 'loading' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop"
            onPress={onStop}
            hitSlop={(minTouchTarget - 34) / 2}
            style={[styles.stop, { backgroundColor: colors.surface2 }]}>
            <AppText variant="label">Stop</AppText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={(minTouchTarget - 36) / 2}
            style={[styles.close, { backgroundColor: colors.surface }]}>
            <X size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {status === 'loading' && (
        <View style={[styles.waitCard, { backgroundColor: colors.surface }]}>
          <FoodLoading source="recipes" />
          <AppText variant="caption" color="inkMuted" style={styles.center}>
            This usually takes about 15 seconds.
          </AppText>
        </View>
      )}

      {status === 'ready' && (
        <Cards recipes={recipes} cuisine={cuisine} canMore={canMore} onCook={onCook} onMore={onMore} />
      )}

      {status === 'error' && (
        <View style={styles.errorBox}>
          <Belly mood="okay" size={88} />
          <AppText variant="displaySmall" style={styles.center}>
            {errorCode === 'RATE_LIMITED' ? 'Kitchen is closed' : "Couldn't get ideas"}
          </AppText>
          <AppText variant="subtitle" color="inkSoft" style={styles.center}>
            {ideasErrorMessage(errorCode ?? 'INTERNAL')}
          </AppText>
          {/* Closed for the day, there is nothing to try again; the X at the top is the way out. */}
          {errorCode !== 'RATE_LIMITED' && (
            <View style={styles.errorActions}>
              <Button label="Try again" onPress={onRetry} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Cards({
  recipes,
  cuisine,
  canMore,
  onCook,
  onMore,
}: Pick<Props, 'recipes' | 'cuisine' | 'canMore' | 'onCook' | 'onMore'>) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(1);
  const scroll = useRef<ScrollViewInstance>(null);
  // The sheet pads 24 each side; a card leaves a peek of the next one inside that width.
  const cardWidth = Math.min(width - space.s3 * 2, 480) - PEEK;
  const step = cardWidth + CARD_GAP;
  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.min(recipes.length, Math.max(1, Math.round(event.nativeEvent.contentOffset.x / step) + 1)));
  const goTo = (next: number) => {
    scroll.current?.scrollTo({ x: (next - 1) * step, animated: true });
    setPage(next);
  };
  return (
    <View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={styles.cards}>
        {recipes.map((recipe, index) => (
          <View
            key={`${recipe.title}-${index}`}
            accessibilityLabel={`Idea ${index + 1} of ${recipes.length}: ${recipe.title}`}
            style={[styles.card, { width: cardWidth, backgroundColor: colors.surface }]}>
            <CuisineArt cuisine={cuisine} height={168} />
            <AppText variant="displaySmall">{recipe.title}</AppText>
            <AppText variant="subtitle" color="inkSoft">
              {recipeMeta(recipe)}
            </AppText>
            <View style={[styles.tag, { backgroundColor: colors.sageTint }]}>
              <Leaf size={14} color={colors.sageInk} strokeWidth={2} />
              <AppText variant="label" color="sageInk">
                Gentle
              </AppText>
            </View>
            <AppText variant="subtitle" color="inkSoft" numberOfLines={3}>
              {recipe.why}
            </AppText>
            <Button label="Cook this" accessibilityHint={recipe.title} onPress={() => onCook(recipe)} />
          </View>
        ))}
      </ScrollView>
      {recipes.length > 1 && <CarouselDots page={page} total={recipes.length} onSelect={goTo} />}
      {canMore ? (
        <Button label="Generate more" variant="secondary" onPress={onMore} />
      ) : (
        <AppText variant="caption" color="inkMuted" style={styles.center}>
          That&apos;s today&apos;s ideas. Bellie is back with more tomorrow.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  title: { flex: 1 },
  stop: {
    height: 34,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  waitCard: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  center: { textAlign: 'center' },
  cards: { gap: CARD_GAP },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 + 4 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  errorBox: { alignItems: 'center', gap: space.s1 + 4, paddingVertical: space.s1 },
  errorActions: { alignSelf: 'stretch', gap: space.s1, marginTop: space.s1 },
});
