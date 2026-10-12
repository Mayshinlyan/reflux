import { StyleSheet, View } from 'react-native';

import { type AvatarKey, avatarDef } from '@/constants/avatars';
import { radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

/**
 * Figma "Avatar": a built-in avatar on its tint. The default is the first letter of the name on clay
 * (small is 44 in Nunito, large is 96 in the Gaegu hero); the others are icons about a third of the circle.
 */
export function Avatar({
  name,
  avatar = 'initial',
  size = 'small',
  diameter: diameterOverride,
}: {
  name: string;
  avatar?: AvatarKey;
  size?: 'small' | 'medium' | 'large';
  /** Overrides the size's diameter (the avatar picker shrinks circles on narrow phones). */
  diameter?: number;
}) {
  const colors = useColors();
  const diameter = diameterOverride ?? DIAMETER[size];
  const def = avatarDef(avatar);
  const Icon = def.icon;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={Icon ? `${def.label} avatar` : name ? `Avatar for ${name}` : 'Avatar'}
      style={[styles.circle, { width: diameter, height: diameter, backgroundColor: colors[def.tint] }]}>
      {Icon ? (
        <Icon size={Math.round(diameter * 0.42)} color={colors[def.ink]} strokeWidth={1.75} />
      ) : (
        <AppText
          variant={size === 'small' ? 'title' : 'hero'}
          style={[
            { color: colors[def.ink] },
            size === 'small' && styles.small,
            size === 'medium' && mediumInitial(diameter),
          ]}>
          {initial}
        </AppText>
      )}
    </View>
  );
}

const DIAMETER = { small: 44, medium: 72, large: 96 } as const;

/** The medium initial is 35/38 at 72; it scales with the circle. */
const mediumInitial = (diameter: number) => ({
  fontSize: Math.round((35 * diameter) / DIAMETER.medium),
  lineHeight: Math.round((38 * diameter) / DIAMETER.medium),
});

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  small: { fontSize: typography.title.fontSize },
});
