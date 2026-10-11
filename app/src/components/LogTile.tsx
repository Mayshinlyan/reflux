import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { type ColorToken, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

/** Biggest the tile gets (Figma: 156); two sit side by side with a 24 gap inside the screen padding. */
const MAX_SIZE = 156;
const GAP = 24;

/** Width of one tile, so that two always fit on a narrow phone. */
export function useLogTileSize() {
  const { width } = useWindowDimensions();
  return Math.min(MAX_SIZE, Math.floor((width - 2 * space.s3 - GAP) / 2));
}

type Props = {
  label: string;
  icon: LucideIcon;
  /** The soft fill behind the icon; the label stays `ink`. */
  tint: ColorToken;
  onPress: () => void;
};

/** Figma "Log tile": a big round tinted button, a 44pt icon over a short label, no subtext. */
export function LogTile({ label, icon: Icon, tint, onPress }: Props) {
  const colors = useColors();
  const size = useLogTileSize();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size, backgroundColor: colors[tint], opacity: pressed ? 0.85 : 1 },
      ]}>
      <Icon size={44} color={colors.ink} strokeWidth={2} />
      <AppText variant="bodyEm">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
