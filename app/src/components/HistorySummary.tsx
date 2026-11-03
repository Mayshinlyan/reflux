import { useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  donutSegments,
  goodLine,
  type HistorySummary as Summary,
  SUMMARY_VERDICTS,
} from '@/lib/historySummary';
import { goodComparison, mostlySymptoms, type PeriodStats } from '@/lib/statsCards';
import { space, useColors, verdictColors } from '@/theme';
import type { Insight } from '@/types/insight';

import { AppText } from './AppText';
import { Belly } from './Belly';
import { tabBarClearance } from './FloatingTabBar';
import { DaysCard } from './stats/DaysCard';
import { MealsCard } from './stats/MealsCard';
import { CardNavContext, StatCard, StatHeader } from './stats/StatCard';
import { WhenCard } from './stats/WhenCard';
import { TipsCard } from './TipsCard';
import { VERDICT_LABELS } from './VerdictBadge';

const CARD_GAP = 12;
/** The least a card is tall, so it is still a card on a very short phone; what it holds then scrolls inside it. */
export const CARD_MIN_HEIGHT = 320;

/**
 * Every card is this one height (Figma row 36): from where the carousel starts down to a gap above the floating tab
 * bar and the Log button that rises over it, so a card never sits under the bar and never changes size. The stats
 * are what History opens on. `listHeight` is the list's own height and `above` the height of what sits over the
 * card.
 */
export const statsCardHeight = (listHeight: number, above: number, bottomInset: number) =>
  Math.max(CARD_MIN_HEIGHT, Math.round(listHeight - above - tabBarClearance(bottomInset)));

/** The donut at its largest; it shrinks to fit a narrow or short card. */
const DONUT_MAX = 256;
const DONUT_MIN = 160;
/** What Food needs besides the donut: padding, header, legend, caption and the gaps between them. */
const FOOD_FIXED = 264;
/** The second line under the donut (the symptoms logged most) and the gap above it. */
const FOOD_EXTRA_LINE = 32;

/**
 * Figma "04a" and rows 28 and 36: the stats carousel, full-width swipeable cards of one fixed height for the shown
 * period, each with two small arrows at its top right to go to the previous or next card. In order: how the week or
 * month went (not for all time or picked dates), what sat well, when symptoms show up, and Food. With Bellie's
 * summary of the week (`insight`), her card comes first (Figma "04a.4", "12b").
 */
export function HistorySummary({
  summary,
  stats,
  height,
  insight,
}: {
  summary: Summary;
  stats: PeriodStats;
  height: number;
  insight?: Insight | null;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 2 * space.s3;
  const step = cardWidth + CARD_GAP;
  const [page, setPage] = useState(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const reduceMotion = useReducedMotion();
  // Food, what sat well and when it shows up are always there; the days only for a week or a month.
  const count = 3 + (stats.unit ? 1 : 0) + (insight ? 1 : 0);
  const nav = {
    page: Math.min(page, count),
    total: count,
    goTo: (next: number) => scroll.current?.scrollTo({ x: (next - 1) * step, animated: !reduceMotion }),
  };
  return (
    <CardNavContext.Provider value={nav}>
      <ScrollView
        ref={scroll}
        horizontal
        contentContainerStyle={styles.cards}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = Math.min(count, Math.max(1, Math.round(event.nativeEvent.contentOffset.x / step) + 1));
          setPage((current) => (current === next ? current : next));
        }}>
        {insight ? <WeekCard insight={insight} width={cardWidth} height={height} /> : null}
        {stats.unit ? <DaysCard stats={stats} width={cardWidth} height={height} /> : null}
        <MealsCard patterns={stats.patterns} width={cardWidth} height={height} />
        <WhenCard stats={stats} summary={summary} width={cardWidth} height={height} />
        <FoodCard summary={summary} stats={stats} width={cardWidth} height={height} />
      </ScrollView>
    </CardNavContext.Provider>
  );
}

type CardProps = { summary: Summary; width: number; height: number };

/** Bellie's week: her face for the tone, a line, a sentence about what stood out, and her tips. */
function WeekCard({ insight, width, height }: { insight: Insight; width: number; height: number }) {
  return (
    <StatCard width={width} height={height} gap={space.s2}>
      <View style={styles.week}>
        <Belly mood={insight.tone === 'nudge' ? 'okay' : 'happy'} size={88} />
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.centered}>
          {insight.bellieLine}
        </AppText>
        <AppText style={styles.centered}>{insight.summary}</AppText>
      </View>
      {insight.tips.length > 0 && <TipsCard tips={insight.tips} />}
    </StatCard>
  );
}

/**
 * The donut with how many meals were good, and how that compares with the last week or month. The symptoms
 * logged most are one line under it (they used to be a card of their own).
 */
function FoodCard({ summary, stats, width, height }: CardProps & { stats: PeriodStats }) {
  const colors = useColors();
  const good = summary.verdicts.good;
  const mostly = mostlySymptoms(summary);
  const comparison = stats.unit ? goodComparison(summary, stats.previousSummary, stats.unit) : undefined;
  const size = Math.max(
    DONUT_MIN,
    Math.min(DONUT_MAX, width - 2 * space.s3, height - FOOD_FIXED - (mostly ? FOOD_EXTRA_LINE : 0)),
  );
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
  return (
    <StatCard width={width} height={height}>
      <StatHeader
        title={`${summary.meals} ${mealWord}`}
        aside={comparison ?? (good === 0 ? undefined : good === 1 ? '1 was good' : `${good} were good`)}
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
            <AppText variant="displaySmall">{String(summary.meals)}</AppText>
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
              <AppText variant="section">{String(summary.verdicts[verdict])}</AppText>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.lines}>
        <AppText variant="voiceSmall" color="inkSoft">
          {goodLine(summary)}
        </AppText>
        {mostly ? (
          <AppText variant="voiceSmall" color="inkSoft">
            {`Mostly ${mostly}.`}
          </AppText>
        ) : null}
      </View>
    </StatCard>
  );
}

const styles = StyleSheet.create({
  // Top-aligned, so a short card keeps its own height instead of stretching to match the tallest.
  cards: { gap: CARD_GAP, alignItems: 'flex-start' },
  week: { alignItems: 'center', gap: space.s2 },
  lines: { gap: space.s1 },
  centered: { textAlign: 'center' },
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
});
