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
import { useSettings } from '@/db/DatabaseProvider';
import { useColors } from '@/theme';

import { BellieHat } from './BellieHat';

type Props = {
  size?: number;
  /** Hops once on arrival (the completion). Still with Reduce Motion on. */
  hop?: boolean;
  /** Wears the hat even if it was not put on yet (the gift reveal). */
  forceHat?: boolean;
  /** A soft floor shadow under it (Figma G1). */
  shadow?: boolean;
};

/** Bellie for the completion flow: it hops once, and wears the hat once "Put it on" was chosen. */
export function HoppingBelly({ size = 168, hop = false, forceHat = false, shadow = false }: Props) {
  const colors = useColors();
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);

  useEffect(() => {
    if (!hop || reduceMotion) return;
    lift.value = withDelay(
      150,
      withSequence(withTiming(-28, { duration: 180 }), withSpring(0, { damping: 6, stiffness: 220 })),
    );
  }, [hop, reduceMotion, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const hatWidth = size * 0.71;
  const hatShown = forceHat || settings.bellieHat;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Belly size={size} />
        {hatShown && (
          <View style={[styles.hat, { top: -size * 0.12, left: (size - hatWidth) / 2 }]}>
            <BellieHat size={hatWidth} />
          </View>
        )}
      </Animated.View>
      {shadow && (
        <View
          style={[styles.shadow, { width: size * 0.71, backgroundColor: colors.surface2 }]}
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hat: { position: 'absolute' },
  shadow: { height: 12, borderRadius: 6, marginTop: 8, opacity: 0.8 },
});
