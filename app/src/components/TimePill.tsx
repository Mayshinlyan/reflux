import { History } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = { label: string; onPress?: () => void };

/** Figma "Time pill": a clock icon and the meal time on a `surface` pill; tappable when `onPress` is set. */
export function TimePill({ label, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={[styles.pill, { backgroundColor: colors.surface }]}>
      <History size={16} color={colors.ink} strokeWidth={2} />
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
});
