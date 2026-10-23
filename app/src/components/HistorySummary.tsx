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
import type { Insight } from '@/types/insight';

import { AppText } from './AppText';
import { Belly } from './Belly';
import { CarouselDots } from './CarouselDots';
import { TipsCard } from './TipsCard';
import { VERDICT_LABELS } from './VerdictBadge';

import { tabBarHeight } from './FloatingTabBar';

const CARD_GAP = 12;
const CARDS = 3;
/** Room the card keeps at its bottom for the ticks (24 tall, 24 from the edge) and a gap above them. */
const TICKS_AREA = 64;
/** The card's side and top padding (Figma 04a). */
const CARD_PAD = 20;
/** The gap between the card and the tab bar (Figma 04a.0). */
const TAB_BAR_GAP = 32;
/** What the tallest card needs, so its content is never cut off on a short phone (it then scrolls under the bar). */
export const CARD_MIN_HEIGHT = 470;

/**
 * The card fills the list's visible height from where it starts down to just above the floating tab bar, so the
 * stats are what History opens on and never sit under the bar. `listHeight` is the list's own height and `above`
 * the height of what sits over the card (title and controls).
 */
export const statsCardHeight = (listHeight: number, above: number, bottomInset: number) =>
  Math.max(CARD_MIN_HEIGHT, Math.round(listHeight - above - (tabBarHeight(bottomInset) + TAB_BAR_GAP)));
/** How far History scrolls before the card and the gap under it have gone (the entries fade in over this). */
export const statsScrollDistance = (cardHeight: number) => cardHeight + space.s4;

/** The donut at its largest; it shrinks to fit a narrow or short card. */
const DONUT_MAX = 256;
const DONUT_MIN = 160;
/** What Food needs besides the donut: padding, header, legend, caption and the gaps between them. */
const FOOD_FIXED = 264;

/**
 * Figma "04a" stats carousel: full-width swipeable cards for the shown period (Food, Top symptoms, Top tags)
 * with page ticks under them. With Bellie's summary of the week (`insight`), her card comes first (Figma
 * "04a.4"), so there are four.
 */
export function HistorySummary({
  summary,
  height,
  insight,
}: {
  summary: Summary;
  height: number;
  insight?: Insight | null;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 2 * space.s3;
  const step = cardWidth + CARD_GAP;
  const [page, setPage] = useState(1);
  const count = insight ? CARDS + 1 : CARDS;
  return (
    <View>
      <ScrollView
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
        <FoodCard summary={summary} width={cardWidth} height={height} />
        <SymptomsCard summary={summary} width={cardWidth} height={height} />
        <TagsCard summary={summary} width={cardWidth} height={height} />
      </ScrollView>
      {/* Inside the bottom of the card, and still while the cards swipe. */}
      <View pointerEvents="none" style={styles.ticks}>
        <CarouselDots page={Math.min(page, count)} total={count} />
      </View>
    </View>
  );
}

type CardProps = { summary: Summary; width: number; height: number };

/** Bellie's week: her face for the tone, a line, a sentence about what stood out, and her tips. */
function WeekCard({ insight, width, height }: { insight: Insight; width: number; height: number }) {
  return (
    <Card width={width} height={height} gap={space.s2}>
      <View style={styles.week}>
        <Belly mood={insight.tone === 'nudge' ? 'okay' : 'happy'} size={88} />
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.centered}>
          {insight.bellieLine}
        </AppText>
        <AppText style={styles.centered}>{insight.summary}</AppText>
      </View>
      {insight.tips.length > 0 && <TipsCard tips={insight.tips} />}
    </Card>
  );
}

/** Food spreads its parts down the card; the bar cards stack theirs from the top with `gap` between. */
function Card({
  width,
  height,
  gap,
  children,
}: {
  width: number;
  height: number;
  gap?: number;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { width, height, backgroundColor: colors.surface },
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
      {aside ? (
        <AppText variant="caption" color="inkSoft">
          {aside}
        </AppText>
      ) : null}
    </View>
  );
}

function FoodCard({ summary, width, height }: CardProps) {
  const colors = useColors();
  const size = Math.max(DONUT_MIN, Math.min(DONUT_MAX, width - 2 * space.s3, height - FOOD_FIXED));
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
    <Card width={width} height={height}>
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

function SymptomsCard({ summary, width, height }: CardProps) {
  const dayWord = summary.symptomDays === 1 ? 'day' : 'days';
  return (
    <Card width={width} height={height} gap={space.s2}>
      <Header
        title="Top symptoms"
        aside={summary.symptomDays === 0 ? 'No symptoms' : `${summary.symptomDays} ${dayWord} with symptoms`}
      />
      <Bars rows={summary.symptoms} fill="clay" />
    </Card>
  );
}

function TagsCard({ summary, width, height }: CardProps) {
  return (
    <Card width={width} height={height} gap={space.s2}>
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
  ticks: { position: 'absolute', left: 0, right: 0, bottom: space.s3 },
  cards: { gap: CARD_GAP },
  card: { borderRadius: radius.lg, padding: CARD_PAD, paddingBottom: TICKS_AREA, overflow: 'hidden' },
  week: { alignItems: 'center', gap: space.s2 },
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
  // The rows share what height is left; 8 is the least between them.
  bars: { flex: 1, gap: 8, justifyContent: 'space-between' },
  bar: { gap: 4 },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s1 },
  barLabel: { flex: 1 },
  track: { height: 14, borderRadius: 7, overflow: 'hidden' },
});
