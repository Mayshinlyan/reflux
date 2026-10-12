import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  donutSegments,
  goodLine,
  type HistorySummary as Summary,
  type RankedCount,
  SUMMARY_VERDICTS,
} from '@/lib/historySummary';
import { type ColorToken, radius, space, useColors, verdictColors } from '@/theme';

import { AppText } from './AppText';
import { CarouselDots } from './CarouselDots';
import { VERDICT_LABELS } from './VerdictBadge';

const CARD_GAP = 12;
const CARDS = 3;
/** Space between the cards and their dots. */
const DOTS_GAP = 14;
const DOTS_HEIGHT = 24;

/** The card takes about two thirds of the screen, so the stats are what History opens on (Figma: 590 of 874). */
const CARD_SHARE = 0.675;
/** What the tallest card needs, so its content is never cut off on a short phone. */
const CARD_MIN_HEIGHT = 584;
export const statsCardHeight = (windowHeight: number) =>
  Math.max(CARD_MIN_HEIGHT, Math.round(windowHeight * CARD_SHARE));
/** How far History scrolls before the cards, their dots and the gap under them have gone (the fade runs over this). */
export const statsScrollDistance = (windowHeight: number) =>
  statsCardHeight(windowHeight) + DOTS_GAP + DOTS_HEIGHT + space.s4;

/** The donut at its largest; it shrinks to fit a narrow card. */
const DONUT_MAX = 256;

/**
 * Figma "04a" stats carousel: three full-width swipeable cards for the shown period (Food, Top symptoms,
 * Top tags) with page ticks under them.
 */
export function HistorySummary({ summary }: { summary: Summary }) {
  const { width, height } = useWindowDimensions();
  const cardWidth = width - 2 * space.s3;
  const step = cardWidth + CARD_GAP;
  const minHeight = statsCardHeight(height);
  const [page, setPage] = useState(1);
  return (
    <View style={styles.carousel}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.cards}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = Math.min(CARDS, Math.max(1, Math.round(event.nativeEvent.contentOffset.x / step) + 1));
          setPage((current) => (current === next ? current : next));
        }}>
        <FoodCard summary={summary} width={cardWidth} minHeight={minHeight} />
        <SymptomsCard summary={summary} width={cardWidth} minHeight={minHeight} />
        <TagsCard summary={summary} width={cardWidth} minHeight={minHeight} />
      </ScrollView>
      <CarouselDots page={page} total={CARDS} />
    </View>
  );
}

type CardProps = { summary: Summary; width: number; minHeight: number };

/** Food spreads its parts down the card; the bar cards stack theirs from the top with `gap` between. */
function Card({
  width,
  minHeight,
  gap,
  children,
}: {
  width: number;
  minHeight: number;
  gap?: number;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { width, minHeight, backgroundColor: colors.surface },
        gap ? { gap } : { justifyContent: 'space-between' },
      ]}>
      {children}
    </View>
  );
}

function Header({ title, aside }: { title: string; aside?: string }) {
  return (
    <View>
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
      {aside ? <AppText color="inkSoft">{aside}</AppText> : null}
    </View>
  );
}

function FoodCard({ summary, width, minHeight }: CardProps) {
  const colors = useColors();
  const size = Math.min(DONUT_MAX, width - 2 * space.s3);
  // Figma's ring: the hole is 70% of the width, so the stroke is the remaining 30% of the radius.
  const stroke = (size / 2) * 0.3;
  const ring = size / 2 - stroke / 2;
  /** A point on the ring, `angle` radians clockwise from 12 o'clock. */
  const onRing = (angle: number) => ({
    x: size / 2 + ring * Math.sin(angle),
    y: size / 2 - ring * Math.cos(angle),
  });
  const segments = donutSegments(summary.verdicts);
  const mealWord = summary.meals === 1 ? 'meal' : 'meals';
  const good = summary.verdicts.good;
  return (
    <Card width={width} minHeight={minHeight}>
      <Header
        title={`${summary.meals} ${mealWord}`}
        aside={good === 0 ? undefined : good === 1 ? '1 was good' : `${good} were good`}
      />
      <View style={styles.chart}>
        <View style={{ width: size, height: size }}>
          {/* The numbers are in the legend, so the ring is left out for screen readers. */}
          <Svg
            width={size}
            height={size}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={ring}
              stroke={colors.surface2}
              strokeWidth={stroke}
              fill="none"
            />
            {segments.length === 1 ? (
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={ring}
                stroke={colors[verdictColors[segments[0]!.verdict].accent]}
                strokeWidth={stroke}
                fill="none"
              />
            ) : (
              segments.map(({ verdict, start, sweep }) => {
                const from = onRing(start);
                const to = onRing(start + sweep);
                return (
                  <Path
                    key={verdict}
                    d={`M ${from.x} ${from.y} A ${ring} ${ring} 0 ${sweep > Math.PI ? 1 : 0} 1 ${to.x} ${to.y}`}
                    stroke={colors[verdictColors[verdict].accent]}
                    strokeWidth={stroke}
                    fill="none"
                  />
                );
              })
            )}
          </Svg>
          <View style={styles.centre}>
            <AppText variant="display">{String(summary.meals)}</AppText>
            <AppText color="inkSoft">{mealWord}</AppText>
          </View>
        </View>
        <View style={styles.legend}>
          {SUMMARY_VERDICTS.map((verdict) => (
            <View key={verdict} style={styles.legendItem}>
              <View style={styles.legendName}>
                <View style={[styles.dot, { backgroundColor: colors[verdictColors[verdict].accent] }]} />
                <AppText color="inkSoft">{VERDICT_LABELS[verdict]}</AppText>
              </View>
              <AppText variant="title">{String(summary.verdicts[verdict])}</AppText>
            </View>
          ))}
        </View>
      </View>
      <AppText color="inkSoft">{goodLine(summary)}</AppText>
    </Card>
  );
}

function SymptomsCard({ summary, width, minHeight }: CardProps) {
  const dayWord = summary.symptomDays === 1 ? 'day' : 'days';
  return (
    <Card width={width} minHeight={minHeight} gap={space.s3}>
      <Header
        title="Top symptoms"
        aside={summary.symptomDays === 0 ? 'No symptoms' : `${summary.symptomDays} ${dayWord} with symptoms`}
      />
      <Bars rows={summary.symptoms} fill="clay" />
    </Card>
  );
}

function TagsCard({ summary, width, minHeight }: CardProps) {
  return (
    <Card width={width} minHeight={minHeight} gap={space.s3}>
      <Header title="Top tags" />
      <Bars rows={summary.tags} fill="sage" />
    </Card>
  );
}

/** Ranked rows: the name and count, then a bar as long as the count is next to the biggest. A 0 is an empty track. */
function Bars({ rows, fill }: { rows: RankedCount[]; fill: ColorToken }) {
  const colors = useColors();
  const most = Math.max(1, ...rows.map((row) => row.count));
  return (
    <View style={styles.bars}>
      {rows.map((row) => (
        <View key={row.key} accessible accessibilityLabel={`${row.label}, ${row.count}`} style={styles.bar}>
          <View style={styles.barTop}>
            <AppText numberOfLines={1} style={styles.barLabel}>
              {row.label}
            </AppText>
            <AppText color="inkSoft">{String(row.count)}</AppText>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
            <View
              style={{ width: `${(row.count / most) * 100}%`, height: '100%', backgroundColor: colors[fill] }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: { gap: DOTS_GAP },
  cards: { gap: CARD_GAP },
  card: { borderRadius: radius.lg, padding: space.s3, overflow: 'hidden' },
  chart: { alignItems: 'center', gap: space.s4 },
  centre: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  legendItem: { alignItems: 'center', gap: 4 },
  legendName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bars: { gap: 20 },
  bar: { gap: space.s1 },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s1 },
  barLabel: { flex: 1 },
  track: { height: 24, borderRadius: 12, overflow: 'hidden' },
});
