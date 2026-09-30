import { Moon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

/** Flags a meal eaten close to bedtime. Always an icon plus a label, never colour alone. */
export function LateMealBadge() {
  const colors = useColors();
  return (
    <View
      style={[styles.badge, { backgroundColor: colors.clayTint }]}
      accessible
      accessibilityLabel="Late meal, close to bedtime">
      <Moon size={14} color={colors.clayInk} strokeWidth={2.4} />
      <AppText variant="label" style={{ color: colors.clayInk }}>
        Late meal
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: space.s1,
    borderRadius: radius.pill,
  },
});
