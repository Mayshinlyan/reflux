import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Belly } from '@/components/Belly';
import { useBellieStage, useBellieWorn } from '@/components/belly/BellieStageContext';
import { bellyLayout } from '@/components/belly/stages';
import { wearItem } from '@/lib/bellieItems';
import type { BellieStage } from '@/lib/bellieStage';
import { useColors } from '@/theme';

type Props = {
  size?: number;
  /** Hops once on arrival (the completion). Still with Reduce Motion on. */
  hop?: boolean;
  /** Wears the hat on top of what Bellie already wears, even if it was not put on yet (the gift reveal). */
  forceHat?: boolean;
  /** A soft floor shadow under it (Figma G1). */
  shadow?: boolean;
  /** Draws this stage instead of the one Bellie has reached (the "Bellie grew" page). */
  stage?: BellieStage;
};

/** Bellie for the completion flow: it hops once, and wears the hat once "Put it on" was chosen. */
export function HoppingBelly({ size = 168, hop = false, forceHat = false, shadow = false, stage }: Props) {
  const colors = useColors();
  const current = useBellieStage();
  const currentWorn = useBellieWorn();
  const shown = stage ?? current;
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);

  useEffect(() => {
    if (!hop || reduceMotion) return;
    lift.value = withDelay(
      60,
      withSequence(withTiming(-28, { duration: 180 }), withSpring(0, { damping: 6, stiffness: 220 })),
    );
  }, [hop, reduceMotion, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const layout = bellyLayout(shown, size);
  const worn = forceHat ? wearItem(currentWorn, 'hat') : currentWorn;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Belly size={size} stage={shown} worn={worn} />
      </Animated.View>
      {shadow && (
        <View
          style={[styles.shadow, { width: layout.width * 0.8, backgroundColor: colors.surface2 }]}
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { height: 12, borderRadius: 6, marginTop: 8, opacity: 0.8 },
});
