import { StyleSheet, View } from 'react-native';

import { radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

/** Figma "Avatar": the first letter on a clay tint. Small is 44 (Nunito), large is 96 (Gaegu hero). */
export function Avatar({ name, size = 'small' }: { name: string; size?: 'small' | 'large' }) {
  const colors = useColors();
  const large = size === 'large';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ? `Avatar for ${name}` : 'Avatar'}
      style={[
        styles.circle,
        { width: large ? 96 : 44, height: large ? 96 : 44, backgroundColor: colors.clayTint },
      ]}>
      <AppText variant={large ? 'hero' : 'title'} style={[{ color: colors.clayInk }, !large && styles.small]}>
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  small: { fontSize: typography.title.fontSize },
});
