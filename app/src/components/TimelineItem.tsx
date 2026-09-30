import { Activity, Carrot, type LucideIcon, Pill, Trash2 } from 'lucide-react-native';
import { type ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { TimelineKind } from '@/lib/timeline';
import { type ColorToken, minTouchTarget, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

const KIND_STYLE: Record<TimelineKind, { icon: LucideIcon; bg: ColorToken; fg: ColorToken; noun: string }> = {
  symptom: { icon: Activity, bg: 'sageTint', fg: 'sageInk', noun: 'Symptoms' },
  food: { icon: Carrot, bg: 'surface2', fg: 'inkSoft', noun: 'Meal' },
  medication: { icon: Pill, bg: 'clayTint', fg: 'clayInk', noun: 'Medication' },
};

type Props = {
  kind: TimelineKind;
  title: string;
  time: string;
  onPress: () => void;
  /** Badges on the right (verdict, late meal). */
  side?: ReactNode;
  /** When set, swiping the row left reveals a Delete button that calls this. */
  onDelete?: () => void;
};

/** One row in the History timeline (the mockup's `.row-item`). */
export function TimelineItem({ kind, title, time, onPress, side, onDelete }: Props) {
  const colors = useColors();
  const { icon: Icon, bg, fg, noun } = KIND_STYLE[kind];
  const swipeable = useRef<SwipeableMethods>(null);
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
        { backgroundColor: colors.surface, borderColor: colors.hairline, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: colors[bg] }]}>
        <Icon size={18} color={colors[fg]} strokeWidth={2.2} />
      </View>
      <View style={styles.main}>
        <AppText style={styles.title} numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" color="inkSoft">
          {time}
        </AppText>
      </View>
      {side}
    </Pressable>
  );
  if (!canSwipe) return row;

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      overshootRight={false}
      rightThreshold={40}
      containerStyle={styles.gap}
      // Only left swipes are handled here, so a swipe right is free to go back to Today.
      renderRightActions={
        onDelete
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${title}`}
                onPress={() => {
                  swipeable.current?.close();
                  onDelete();
                }}
                style={[styles.deleteAction, { backgroundColor: colors.cta }]}>
                <Trash2 size={20} color={colors.ctaInk} strokeWidth={2.2} />
                <AppText style={[styles.actionText, { color: colors.ctaInk }]}>Delete</AppText>
              </Pressable>
            )
          : undefined
      }>
      {row}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    width: 88,
    minHeight: minTouchTarget,
    marginLeft: space.s1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionText: { ...typography.label, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gap: { marginBottom: space.s1 },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyEm, fontSize: 15, lineHeight: 20, fontFamily: typography.button.fontFamily },
});
