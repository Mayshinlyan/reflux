import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Option<T extends string> = {
  value: T;
  /** The text on the segment, or its name for a screen reader when it shows an icon instead. */
  label: string;
  /** Shown in place of the text, e.g. the infinity mark. */
  icon?: LucideIcon;
  /** What a screen reader says, when it should be longer than the text ("Week" for "W"). */
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  options: readonly Option<T>[];
  /** Null when none of them applies, e.g. a range picked by hand. */
  value: T | null;
  onChange: (value: T) => void;
  /** Sits inside a row (Kitchen sheet): options 36pt tall, so the track is 44pt, instead of full touch-target height. */
  compact?: boolean;
};

/** Figma "Segmented control" (W / M / infinity): a `surface2` track with the current option on `surface`. */
export function SegmentedControl<T extends string>({ options, value, onChange, compact = false }: Props<T>) {
  const colors = useColors();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.surface2 }]}>
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            hitSlop={compact ? { top: 4, bottom: 4 } : undefined}
            style={({ pressed }) => [
              styles.option,
              compact && styles.compactOption,
              Icon && styles.iconOption,
              selected && { backgroundColor: colors.surface },
              { opacity: pressed ? 0.85 : 1 },
            ]}>
            {Icon ? (
              <Icon size={20} strokeWidth={2} color={selected ? colors.ink : colors.inkSoft} />
            ) : (
              <AppText variant="label" color={selected ? 'ink' : 'inkSoft'}>
                {option.label}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'flex-start', padding: 4, borderRadius: radius.pill },
  option: {
    minHeight: minTouchTarget,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactOption: { minHeight: 36, paddingVertical: 4 },
  iconOption: { paddingHorizontal: 14 },
});
