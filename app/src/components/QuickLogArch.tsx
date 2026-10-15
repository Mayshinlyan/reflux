import { Activity, Camera, type LucideIcon, Pill } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { type ColorToken, shadow, useColors } from '@/theme';

import { AppText } from './AppText';
import { tabBarHeight } from './FloatingTabBar';

export type LogKind = 'food' | 'symptoms' | 'medication';

const ITEMS: { kind: LogKind; label: string; icon: LucideIcon; tint: ColorToken; angle: number }[] = [
  { kind: 'food', label: 'Snap food', icon: Camera, tint: 'honeyTint', angle: 140 },
  { kind: 'symptoms', label: 'How I feel', icon: Activity, tint: 'clayTint', angle: 90 },
  { kind: 'medication', label: 'Medication', icon: Pill, tint: 'sageTint', angle: 40 },
];

/** The arch's radius around the Log button's centre, and the size of each round button on it. */
const RADIUS = 128;
const BUTTON = 56;
const LABEL_WIDTH = 96;
/** The Log button's centre sits 8 below the bar's top edge (it is 64 tall and rises 24). */
const LOG_CENTRE_BELOW_BAR_TOP = 8;
/** Same dim as the bottom sheets. */
const SCRIM = 'rgba(30,26,22,0.42)';

type Props = {
  /** The screen's bottom safe-area inset, so the arch lines up with the Log button. */
  bottomInset: number;
  onPick: (kind: LogKind) => void;
  onClose: () => void;
};

/**
 * Figma "02d": tapping Log fans three round buttons (food, symptom, medication) in an arch above it, over a
 * dimmed screen. Rendered under the tab bar, so the bar and its close button stay visible and tappable.
 */
export function QuickLogArch({ bottomInset, onPick, onClose }: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(progress, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [progress]);

  const centreFromBottom = tabBarHeight(bottomInset) - LOG_CENTRE_BELOW_BAR_TOP;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss quick log"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]}
      />
      {ITEMS.map(({ kind, label, icon: Icon, tint, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const dx = RADIUS * Math.cos(rad);
        const dy = RADIUS * Math.sin(rad);
        return (
          <Animated.View
            key={kind}
            style={[
              styles.item,
              {
                left: width / 2 + dx - BUTTON / 2,
                bottom: centreFromBottom + dy - BUTTON / 2,
                opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
                // Each button flies out from the Log button's centre to its place on the arch.
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] }) },
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                ],
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => onPick(kind)}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors[tint], boxShadow: shadow.softLift, opacity: pressed ? 0.85 : 1 },
              ]}>
              <Icon size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            {/* Absolute, so the button's own position is exact whatever the label's height. */}
            <AppText variant="label" color="bg" style={styles.label}>
              {label}
            </AppText>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', width: BUTTON, height: BUTTON },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    top: BUTTON + 8,
    left: (BUTTON - LABEL_WIDTH) / 2,
    width: LABEL_WIDTH,
    textAlign: 'center',
  },
});
