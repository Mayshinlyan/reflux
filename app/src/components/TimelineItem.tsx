import { Activity, Leaf, type LucideIcon, Pill, Utensils } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TimelineKind } from '@/lib/timeline';
import { cardEdge, type ColorToken, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { SwipeToDelete } from './SwipeToDelete';

const KIND_STYLE: Record<TimelineKind, { icon: LucideIcon; bg: ColorToken; fg: ColorToken; noun: string }> = {
  symptom: { icon: Activity, bg: 'surface2', fg: 'ink', noun: 'Symptoms' },
  food: { icon: Utensils, bg: 'surface2', fg: 'ink', noun: 'Meal' },
  medication: { icon: Pill, bg: 'clayTint', fg: 'clayInk', noun: 'Medication' },
};

/** A check-in with lifestyle factors and no symptoms: the leaf, not the pulse. */
const LIFESTYLE_STYLE = { icon: Leaf, bg: 'surface2', fg: 'ink', noun: 'Lifestyle' } as const;

type Props = {
  kind: TimelineKind;
  /** A symptom-kind entry that has no symptoms, only lifestyle factors. */
  lifestyle?: boolean;
  title: string;
  time: string;
  onPress: () => void;
  /** Badges on the right (verdict, late meal). */
  side?: ReactNode;
  /** When set, swiping the row left reveals a Delete button that calls this. */
  onDelete?: () => void;
};

/** One diary row (Figma "Meal row" / "Medication row"): filled `surface`, no border. Doses carry a "Taken" pill. */
export function TimelineItem({ kind, lifestyle, title, time, onPress, side, onDelete }: Props) {
  const colors = useColors();
  const { icon: Icon, bg, fg, noun } = lifestyle ? LIFESTYLE_STYLE : KIND_STYLE[kind];
  const canSwipe = Boolean(onDelete);
  const row = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${noun}: ${title}, ${time}`}
      accessibilityHint="Shows details"
      // Swiping isn't possible with a screen reader, so offer the same action from its actions menu.
      accessibilityActions={canSwipe ? [{ name: 'delete', label: 'Delete' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') onDelete?.();
      }}
      style={({ pressed }) => [
        styles.row,
        !canSwipe && styles.gap,
        {
          backgroundColor: colors.surface,
          ...cardEdge(colors),
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[styles.icon, { backgroundColor: colors[bg] }]}>
        <Icon size={20} color={colors[fg]} strokeWidth={2} />
      </View>
      <View style={styles.main}>
        <AppText variant="button" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" color="inkSoft">
          {time}
        </AppText>
      </View>
      {side ??
        (kind === 'medication' ? (
          <View style={[styles.taken, { backgroundColor: colors.sageTint }]}>
            <AppText variant="label" color="sageInk">
              Taken
            </AppText>
          </View>
        ) : null)}
    </Pressable>
  );
  if (!onDelete) return row;

  // A swipe right stays free to go back to Today.
  return (
    <SwipeToDelete label={title} onDelete={onDelete} style={styles.gap}>
      {row}
    </SwipeToDelete>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: space.s1_5,
  },
  gap: { marginBottom: space.s1_5 },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0 },
  taken: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: radius.pill },
});
