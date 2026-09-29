import { Activity, Camera, type LucideIcon, Pill } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TimelineKind } from '@/lib/timeline';
import { type ColorToken, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

const KIND_STYLE: Record<TimelineKind, { icon: LucideIcon; bg: ColorToken; fg: ColorToken; noun: string }> = {
  symptom: { icon: Activity, bg: 'sageTint', fg: 'sageInk', noun: 'Symptoms' },
  food: { icon: Camera, bg: 'surface2', fg: 'inkSoft', noun: 'Meal' },
  medication: { icon: Pill, bg: 'clayTint', fg: 'clayInk', noun: 'Medication' },
};

type Props = {
  kind: TimelineKind;
  title: string;
  time: string;
  onPress: () => void;
  /** Badges on the right (verdict, late meal). */
  side?: ReactNode;
};

/** One row in the History timeline (the mockup's `.row-item`). */
export function TimelineItem({ kind, title, time, onPress, side }: Props) {
  const colors = useColors();
  const { icon: Icon, bg, fg, noun } = KIND_STYLE[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${noun}: ${title}, ${time}`}
      accessibilityHint="Shows details"
      style={({ pressed }) => [
        styles.row,
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
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: space.s1,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyEm, fontSize: 15, lineHeight: 20, fontFamily: typography.button.fontFamily },
});
