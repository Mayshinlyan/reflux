import { Mic } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FoodLoading } from '@/components/FoodLoading';
import { radius, space, typography, useColors } from '@/theme';

import { TypeInstead } from './TypeInstead';

const CORE = 120;
const RINGS = [
  { size: 232, opacity: 0.08 },
  { size: 176, opacity: 0.14 },
];

/** The big olive mic with two soft rings that breathe while listening (still under Reduce Motion). */
function MicPulse() {
  const colors = useColors();
  const still = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse, still]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.05 }] }));
  return (
    <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {RINGS.map((ring) => (
        <Animated.View
          key={ring.size}
          style={[
            styles.ring,
            { width: ring.size, height: ring.size, opacity: ring.opacity, backgroundColor: colors.cta },
            ringStyle,
          ]}
        />
      ))}
      <View style={[styles.core, { backgroundColor: colors.cta }]}>
        <Mic size={48} color={colors.ctaInk} strokeWidth={2} />
      </View>
    </View>
  );
}

type Props = {
  /** Listening: the words appear as they are heard. Working: the same words stay while Bellie sorts them out. */
  phase: 'listening' | 'working';
  words: string;
  onDone: () => void;
  onTypeInstead: () => void;
};

/**
 * Figma 45b and 45c. Listening is one big mic, the words as they come, "Done" and "Type instead". Working keeps
 * the words and shows the app's own steaming-pot loader, unchanged.
 */
export function VoiceListening({ phase, words, onDone, onTypeInstead }: Props) {
  const listening = phase === 'listening';
  return (
    <>
      <View style={styles.body}>
        <AppText variant="hero" accessibilityRole="header" style={styles.centre}>
          {listening ? "I'm listening" : 'Got it'}
        </AppText>
        <AppText variant="voice" color="inkSoft" style={styles.centre}>
          {listening ? 'Say what you ate or how you feel.' : 'Just a moment.'}
        </AppText>
        <View style={styles.middle}>{listening ? <MicPulse /> : <FoodLoading source="voice" />}</View>
        <AppText
          accessibilityLiveRegion="polite"
          color={listening ? 'ink' : 'inkSoft'}
          style={[styles.centre, styles.words]}>
          {words ? `“${words}”` : ''}
        </AppText>
      </View>
      {listening && (
        <View style={styles.footer}>
          <Button label="Done" onPress={onDone} />
          <TypeInstead onPress={onTypeInstead} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: space.s3, gap: space.s1 },
  centre: { textAlign: 'center' },
  middle: { height: 260, alignItems: 'center', justifyContent: 'center', marginTop: space.s3 },
  stage: { width: RINGS[0].size, height: RINGS[0].size, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: radius.pill },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { ...typography.lead, paddingHorizontal: space.s3, minHeight: 100 },
  footer: { paddingTop: space.s2, paddingBottom: space.s1, gap: space.s1 },
});
