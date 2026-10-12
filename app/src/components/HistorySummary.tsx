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

/** The card is 24 narrower than the space between the screen's margins, so the next one peeks in. */
const PEEK = space.s3;
const CARD_GAP = 12;
const CARD_HEIGHT = 252;
const CARDS = 3;

const DONUT = 112;
/** Figma's ring: the hole is 70% of the width, so the stroke is the remaining 30% of the radius. */
const STROKE = (DONUT / 2) * 0.3;
const RING = DONUT / 2 - STROKE / 2;

/** A point on the ring, `angle` radians clockwise from 12 o'clock. */
const onRing = (angle: number) => ({
  x: DONUT / 2 + RING * Math.sin(angle),
  y: DONUT / 2 - RING * Math.cos(angle),
});

/**
 * Figma "04a" stats carousel: three swipeable cards for the shown period (Food, Top symptoms, Top tags)
 * with page dots under them.
 */
export function HistorySummary({ summary }: { summary: Summary }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 2 * space.s3 - PEEK;
  const step = cardWidth + CARD_GAP;
  const [page, setPage] = useState(1);
  return (
    <View style={styles.carousel}>
      <ScrollView
        horizontal
        // The row runs on to the screen's edge, where the next card shows.
        style={styles.scroller}
        // Room after the last card, so it can come to rest at the left edge like the others.
        contentContainerStyle={[styles.cards, { paddingRight: PEEK + space.s3 }]}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = Math.min(CARDS, Math.max(1, Math.round(event.nativeEvent.contentOffset.x / step) + 1));
          setPage((current) => (current === next ? current : next));
        }}>
        <FoodCard summary={summary} width={cardWidth} />
        <SymptomsCard summary={summary} width={cardWidth} />
        <TagsCard summary={summary} width={cardWidth} />
      </ScrollView>
      <CarouselDots page={page} total={CARDS} />
    </View>
  );
}

/** Food spreads its parts down the card; the bar cards stack theirs from the top with `gap` between. */
function Card({ width, gap, children }: { width: number; gap?: number; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { width, backgroundColor: colors.surface },
        gap ? { gap } : { justifyContent: 'space-between' },
      ]}>
      {children}
    </View>
  );
}

function Header({ title, aside }: { title: string; aside?: string }) {
  return (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header">
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

function FoodCard({ summary, width }: { summary: Summary; width: number }) {
  const colors = useColors();
  const segments = donutSegments(summary.verdicts);
  const mealWord = summary.meals === 1 ? 'meal' : 'meals';
  const good = summary.verdicts.good;
  return (
    <Card width={width}>
      <Header
        title={`${summary.meals} ${mealWord}`}
        aside={good === 0 ? undefined : good === 1 ? '1 was good' : `${good} were good`}
      />
      <View style={styles.chart}>
        <View style={styles.donut}>
          {/* The numbers are in the legend, so the ring is left out for screen readers. */}
          <Svg
            width={DONUT}
            height={DONUT}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Circle
              cx={DONUT / 2}
              cy={DONUT / 2}
              r={RING}
              stroke={colors.surface2}
              strokeWidth={STROKE}
              fill="none"
            />
            {segments.length === 1 ? (
              <Circle
                cx={DONUT / 2}
                cy={DONUT / 2}
                r={RING}
                stroke={colors[verdictColors[segments[0]!.verdict].accent]}
                strokeWidth={STROKE}
                fill="none"
              />
            ) : (
              segments.map(({ verdict, start, sweep }) => {
                const from = onRing(start);
                const to = onRing(start + sweep);
                return (
                  <Path
                    key={verdict}
                    d={`M ${from.x} ${from.y} A ${RING} ${RING} 0 ${sweep > Math.PI ? 1 : 0} 1 ${to.x} ${to.y}`}
                    stroke={colors[verdictColors[verdict].accent]}
                    strokeWidth={STROKE}
                    fill="none"
                  />
                );
              })
            )}
          </Svg>
          <View style={styles.centre}>
            <AppText variant="title">{String(summary.meals)}</AppText>
            <AppText variant="caption" color="inkSoft">
              {mealWord}
            </AppText>
          </View>
        </View>
        <View style={styles.legend}>
          {SUMMARY_VERDICTS.map((verdict) => (
            <View key={verdict} style={styles.legendRow}>
              <View style={styles.legendName}>
                <View style={[styles.dot, { backgroundColor: colors[verdictColors[verdict].accent] }]} />
                <AppText variant="caption" color="inkSoft">
                  {VERDICT_LABELS[verdict]}
                </AppText>
              </View>
              <AppText variant="caption">{String(summary.verdicts[verdict])}</AppText>
            </View>
          ))}
        </View>
      </View>
      <AppText variant="caption" color="inkSoft">
        {goodLine(summary)}
      </AppText>
    </Card>
  );
}

function SymptomsCard({ summary, width }: { summary: Summary; width: number }) {
  const dayWord = summary.symptomDays === 1 ? 'day' : 'days';
  return (
    <Card width={width} gap={14}>
      <Header
        title="Top symptoms"
        aside={summary.symptomDays === 0 ? 'No symptoms' : `${summary.symptomDays} ${dayWord} with symptoms`}
      />
      {summary.symptoms.length === 0 ? (
        <AppText variant="caption" color="inkSoft">
          No symptoms logged in this period.
        </AppText>
      ) : (
        <Bars rows={summary.symptoms} fill="clay" />
      )}
    </Card>
  );
}

function TagsCard({ summary, width }: { summary: Summary; width: number }) {
  return (
    <Card width={width} gap={14}>
      <Header title="Top tags" />
      <Bars rows={summary.tags} fill="sage" />
    </Card>
  );
}

/** Ranked rows: the name, a bar as long as its count is next to the biggest, and the count. A 0 is an empty track. */
function Bars({ rows, fill }: { rows: RankedCount[]; fill: ColorToken }) {
  const colors = useColors();
  const most = Math.max(1, ...rows.map((row) => row.count));
  return (
    <View style={styles.bars}>
      {rows.map((row) => (
        <View key={row.key} accessible accessibilityLabel={`${row.label}, ${row.count}`} style={styles.bar}>
          <AppText variant="caption" numberOfLines={1} style={styles.barLabel}>
            {row.label}
          </AppText>
          <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
            <View
              style={{ width: `${(row.count / most) * 100}%`, height: '100%', backgroundColor: colors[fill] }}
            />
          </View>
          <AppText variant="caption" color="inkSoft" style={styles.barCount}>
            {String(row.count)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: { gap: CARD_GAP },
  scroller: { marginRight: -space.s3 },
  cards: { gap: CARD_GAP },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    padding: space.s2,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.s1 },
  chart: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donut: { width: DONUT, height: DONUT },
  centre: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bars: { gap: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 128 },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  barCount: { width: 24, textAlign: 'right' },
});
