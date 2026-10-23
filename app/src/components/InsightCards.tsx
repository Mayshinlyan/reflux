import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useSettings } from '@/db/DatabaseProvider';
import { radius, space, useColors } from '@/theme';
import type { Insight } from '@/types/insight';

import { AppText } from './AppText';
import { CarouselDots } from './CarouselDots';
import { TipsCard } from './TipsCard';

const CARD_GAP = 12;
/** How much of the next card shows beside the one in view, so it is clear there is more to swipe to. */
const PEEK = 24;
/** The one-time nudge: the cards slide this far and back. */
const NUDGE_X = 36;
const NUDGE_DELAY_MS = 900;
const NUDGE_BACK_MS = 600;

/** A text card has a `title` and `body`; the tips card has just `tips`. */
type Card = { key: string; title?: string; body?: string; tips?: string[] };

type Props = {
  /** Bellie's summary of today, if anything is logged. */
  today: Insight | null;
  /** Bellie's summary of this week. */
  week: Insight | null;
};

/**
 * Figma "02f Home": swipeable cards under Bellie: Today so far, Tips (her ideas for next time), This week.
 * The next card peeks in from the right and ticks sit under the row. A card with nothing to say is left out.
 */
export function InsightCards({ today, week }: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { settings, update } = useSettings();
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(1);

  const cards = useMemo<Card[]>(() => {
    const list: Card[] = [];
    if (today?.summary) list.push({ key: 'today', title: 'Today so far', body: today.summary });
    const tips = today && today.tips.length > 0 ? today.tips : (week?.tips ?? []);
    if (tips.length > 0) list.push({ key: 'tips', tips });
    if (week?.summary) list.push({ key: 'week', title: 'This week', body: week.summary });
    return list;
  }, [today, week]);

  const cardWidth = width - 2 * space.s3 - PEEK;
  const step = cardWidth + CARD_GAP;
  const nudge = cards.length > 1 && !settings.insightNudged && !reduceMotion;

  // A little slide the first time the cards appear: the next one is there. Played once, ever.
  useEffect(() => {
    if (!nudge) return;
    const out = setTimeout(() => {
      scroll.current?.scrollTo({ x: NUDGE_X, animated: true });
      update('insightNudged', true);
    }, NUDGE_DELAY_MS);
    const back = setTimeout(
      () => scroll.current?.scrollTo({ x: 0, animated: true }),
      NUDGE_DELAY_MS + NUDGE_BACK_MS,
    );
    return () => {
      clearTimeout(out);
      clearTimeout(back);
    };
    // `update` is stable for the screen's life; the nudge flips off once it has played.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge]);

  if (cards.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {/* Runs to the screen's right edge so the next card can show; the page's own padding is 24. */}
      <ScrollView
        ref={scroll}
        horizontal
        style={styles.bleed}
        contentContainerStyle={styles.row}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = Math.min(
            cards.length,
            Math.max(1, Math.round(event.nativeEvent.contentOffset.x / step) + 1),
          );
          setPage((current) => (current === next ? current : next));
        }}>
        {cards.map((card) =>
          card.tips ? (
            <TipsCard key={card.key} tips={card.tips} style={{ width: cardWidth }} />
          ) : (
            <View key={card.key} style={[styles.card, { width: cardWidth, backgroundColor: colors.surface }]}>
              <AppText variant="sectionSm">{card.title}</AppText>
              <AppText variant="small">{card.body}</AppText>
            </View>
          ),
        )}
      </ScrollView>
      {cards.length > 1 && <CarouselDots page={Math.min(page, cards.length)} total={cards.length} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s1 },
  bleed: { marginRight: -space.s3 },
  row: { gap: CARD_GAP, paddingRight: space.s3 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: 8 },
});
