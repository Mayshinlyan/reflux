import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { createContext, type ReactNode, useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { RankedCount } from '@/lib/historySummary';
import { cardEdge, type ColorToken, radius, space, useColors } from '@/theme';

import { AppText } from '../AppText';

/** The card's padding on every side (Figma 04a). */
export const CARD_PAD = 20;

/** Where the carousel is, so the arrows in each card know which way they can go. */
type CardNav = { page: number; total: number; goTo: (page: number) => void };
export const CardNavContext = createContext<CardNav | null>(null);

const ARROW = 32;
const ARROW_GAP = space.s1;
/** What the arrows take at the card's top right: the header leaves this much clear so a title never runs under them. */
const ARROWS_CLEARANCE = ARROW * 2 + ARROW_GAP + space.s1_5;

/**
 * Two small round arrows at the card's top right (Figma row 36): previous and next card. The one that cannot go
 * further is dimmed. Swiping still works; these are the way to see there is more.
 */
function CardArrows() {
  const colors = useColors();
  const nav = useContext(CardNavContext);
  if (!nav || nav.total < 2) return null;
  const { page, total, goTo } = nav;
  const arrows = [
    { label: 'Previous card', icon: ChevronLeft, to: page - 1, enabled: page > 1 },
    { label: 'Next card', icon: ChevronRight, to: page + 1, enabled: page < total },
  ] as const;
  return (
    <View style={styles.arrows}>
      {arrows.map(({ label, icon: Icon, to, enabled }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${enabled ? `${to} of ${total}` : `none, you are on ${page} of ${total}`}`}
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          hitSlop={6}
          onPress={() => goTo(to)}
          style={({ pressed }) => [
            styles.arrow,
            { backgroundColor: colors.surface2, opacity: !enabled ? 0.4 : pressed ? 0.7 : 1 },
          ]}>
          <Icon size={18} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Every stat card is one fixed `height` (Figma row 36), so the carousel never changes size and never runs under the
 * tab bar. Cards stack their parts from the top with `gap` between; without one (Food) the parts spread down the
 * height. What a card holds is sized to fit; if it ever does not (a short phone, larger text) it scrolls inside the
 * card instead of being cut off.
 */
export function StatCard({
  width,
  height,
  gap,
  children,
}: {
  width: number;
  height: number;
  gap?: number;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.card, { width, height, backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <ScrollView
        nestedScrollEnabled
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          gap ? { gap } : { flexGrow: 1, justifyContent: 'space-between' },
        ]}>
        {children}
      </ScrollView>
      <CardArrows />
    </View>
  );
}

/** The card's title (two lines at most) and the caption under it, clear of the arrows. */
export function StatHeader({ title, aside }: { title: string; aside?: string }) {
  return (
    <View style={styles.header}>
      <AppText variant="displaySmall" accessibilityRole="header" numberOfLines={2}>
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

/** Ranked rows: the name and count, then a bar as long as the count is next to the biggest. A 0 is an empty track. */
export function Bars({ rows, fill }: { rows: RankedCount[]; fill: ColorToken }) {
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
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  content: { padding: CARD_PAD },
  header: { paddingRight: ARROWS_CLEARANCE },
  arrows: { position: 'absolute', top: CARD_PAD + 2, right: CARD_PAD, flexDirection: 'row', gap: ARROW_GAP },
  arrow: {
    width: ARROW,
    height: ARROW,
    borderRadius: ARROW / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The rows share what height is left; 8 is the least between them.
  bars: { gap: 8, justifyContent: 'space-between' },
  bar: { gap: 4 },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s1 },
  barLabel: { flex: 1 },
  track: { height: 14, borderRadius: 7, overflow: 'hidden' },
});
