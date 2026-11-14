import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  runOnJS,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Ellipse, Rect } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import type { GiftDay } from '@/lib/completionFlow';
import { cardEdge, radius, space, useColors } from '@/theme';

import { CompletionLayout } from './CompletionLayout';
import { Confetti } from './Confetti';
import { HoppingBelly } from './HoppingBelly';

type Props = {
  day: GiftDay;
  /** "Put it on" (the hat): saved and closed. */
  onWear: () => void;
  /** "See my report" (day 7). */
  onReport: () => void;
  /** "Later", or finishing. */
  onDone: () => void;
};

/** Screen 4 (Figma G4): a wrapped gift that wiggles; tapping Open it shows what is inside. Day 3 a hat, day 7 the report. */
export function GiftPage({ day, onWear, onReport, onDone }: Props) {
  const [opened, setOpened] = useState(false);
  if (!opened) return <ClosedGift day={day} onOpen={() => setOpened(true)} />;
  return day === 3 ? (
    <CompletionLayout
      backdrop={<Confetti />}
      action={{ label: 'Put it on', onPress: onWear }}
      quiet={{ label: 'Later', onPress: onDone }}>
      <HoppingBelly forceHat shadow size={240} />
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        A little hat for Bellie
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        Find it any time in Customize Bellie.
      </AppText>
    </CompletionLayout>
  ) : (
    <ReportGift onReport={onReport} onDone={onDone} />
  );
}

function ClosedGift({ day, onOpen }: { day: GiftDay; onOpen: () => void }) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    tilt.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 120 }),
          withTiming(5, { duration: 120 }),
          withTiming(0, { duration: 120 }),
          withDelay(900, withTiming(0, { duration: 1 })),
        ),
        -1,
      ),
    );
  }, [reduceMotion, tilt]);
  const pop = useSharedValue(1);
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    if (!opening) return;
    pop.value = withSequence(
      withTiming(0.88, { duration: 90 }),
      withTiming(1.45, { duration: 200 }, (finished) => {
        if (finished) runOnJS(onOpen)();
      }),
    );
  }, [opening, pop, onOpen]);
  const wiggle = useAnimatedStyle(() => ({
    opacity: pop.value > 1 ? Math.max(0, 2.2 - pop.value * 1.5) : 1,
    transform: [{ rotate: `${tilt.value}deg` }, { scale: pop.value }],
  }));
  // Tapping the gift (or the button) pops it open: it swells and fades as the reveal begins.
  const open = () => (reduceMotion ? onOpen() : setOpening(true));

  return (
    <CompletionLayout backdrop={<Confetti count={8} />} action={{ label: 'Open it', onPress: open }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open the gift" onPress={open}>
        <Animated.View style={wiggle}>
          <Svg width={200} height={200} viewBox="0 0 200 200">
            <Rect
              x={28}
              y={64}
              width={144}
              height={112}
              rx={14}
              fill={colors.honeyTint}
              stroke={colors.honey}
              strokeWidth={2}
            />
            <Rect x={20} y={32} width={160} height={44} rx={12} fill={colors.honey} />
            <Rect x={88} y={32} width={24} height={144} fill={colors.clay} />
            <Ellipse cx={80} cy={22} rx={23} ry={19} fill={colors.clay} rotation={-20} origin="80, 22" />
            <Ellipse cx={120} cy={16} rx={23} ry={19} fill={colors.clay} rotation={20} origin="120, 16" />
          </Svg>
        </Animated.View>
      </Pressable>
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        Bellie left you a gift
      </AppText>
      <AppText color="inkSoft" style={styles.line}>{`For ${day} days of check-ins`}</AppText>
    </CompletionLayout>
  );
}

function ReportGift({ onReport, onDone }: { onReport: () => void; onDone: () => void }) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  return (
    <CompletionLayout
      backdrop={<Confetti />}
      action={{ label: 'See my report', onPress: onReport }}
      quiet={{ label: 'Later', onPress: onDone }}>
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
        style={[styles.preview, { backgroundColor: colors.surface, ...cardEdge(colors) }]}
        importantForAccessibility="no-hide-descendants">
        <AppText variant="displaySmall">Your week with Bellie</AppText>
        {[130, 110, 90].map((width) => (
          <View key={width} style={styles.previewRow}>
            <View style={[styles.avatar, { backgroundColor: colors.sageTint }]} />
            <View style={{ gap: 6 }}>
              <View style={[styles.line1, { width, backgroundColor: colors.surface2 }]} />
              <View style={[styles.line1, { width: 70, height: 6, backgroundColor: colors.surface2 }]} />
            </View>
          </View>
        ))}
        <View style={[styles.newTag, { backgroundColor: colors.cta }]}>
          <AppText variant="label" color="ctaInk">
            New
          </AppText>
        </View>
      </Animated.View>
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        Your first pattern is ready
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        A week of check-ins did it.
      </AppText>
    </CompletionLayout>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.s3, textAlign: 'center' },
  line: { marginTop: space.s1, textAlign: 'center' },
  preview: { width: 248, borderRadius: radius.lg, padding: space.s3, gap: space.s1_5 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  line1: { height: 8, borderRadius: 4 },
  newTag: {
    position: 'absolute',
    top: -14,
    left: 19,
    borderRadius: radius.pill,
    paddingHorizontal: space.s3,
    paddingVertical: 6,
  },
});
