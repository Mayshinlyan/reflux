import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Figma "Segmented control" (Week / Month): a `surface2` track with the current option on `surface`. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const colors = useColors();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.surface2 }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && { backgroundColor: colors.surface }]}>
            <AppText variant="label" color={selected ? 'ink' : 'inkSoft'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'flex-start', padding: 4, borderRadius: radius.pill },
  option: {
    minHeight: Math.max(minTouchTarget - 8, 36),
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
