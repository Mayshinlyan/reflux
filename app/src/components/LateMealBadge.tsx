import { Moon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

/** Flags a meal eaten close to bedtime. Always an icon plus a label, never colour alone. */
export function LateMealBadge() {
  const colors = useColors();
  return (
    <View
      style={[styles.badge, { backgroundColor: colors.surface2 }]}
      accessible
      accessibilityLabel="Late meal, close to bedtime">
      <Moon size={16} color={colors.inkSoft} strokeWidth={2} />
      <AppText variant="label" style={{ color: colors.inkSoft }}>
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
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
});
