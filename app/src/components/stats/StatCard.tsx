import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RankedCount } from '@/lib/historySummary';
import { cardEdge, type ColorToken, radius, space, useColors } from '@/theme';

import { AppText } from '../AppText';

/** The card's padding on every side (Figma 04a). The dots are under the card, not in it. */
export const CARD_PAD = 20;

/**
 * Food spreads its parts down the full `height`; the others stack theirs from the top with `gap` between and are only
 * as tall as their content, so a card with little to say does not run down into the tab bar.
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
    <View
      style={[
        styles.card,
        { width, backgroundColor: colors.surface, ...cardEdge(colors) },
        // A card with a `gap` is as tall as what it holds. Food spreads its parts down the full height instead.
        gap ? { gap } : { justifyContent: 'space-between', minHeight: height },
      ]}>
      {children}
    </View>
  );
}

export function StatHeader({ title, aside }: { title: string; aside?: string }) {
  return (
    <View>
      <AppText variant="displaySmall" accessibilityRole="header">
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
  card: { borderRadius: radius.lg, padding: CARD_PAD, overflow: 'hidden' },
  // The rows share what height is left; 8 is the least between them.
  bars: { gap: 8, justifyContent: 'space-between' },
  bar: { gap: 4 },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s1 },
  barLabel: { flex: 1 },
  track: { height: 14, borderRadius: 7, overflow: 'hidden' },
});
