import { Mic, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { LOG_KINDS, type LogKind } from '@/lib/logKinds';
import { type ColorToken, shadow, useColors } from '@/theme';

import { AppText } from './AppText';
import { LOG_CENTRE_BELOW_BAR_TOP, tabBarHeight } from './FloatingTabBar';

export type { LogKind };

/** The arch adds "Tell me" (speak it) to the three things that can be logged. */
export type ArchKind = LogKind | 'voice';

type ArchEntry = { kind: ArchKind; label: string; icon: LucideIcon; tint: ColorToken; iconColor: ColorToken };

/** Figma 45a: Food, How I feel, Tell me, Medication, left to right. "Tell me" is a white bubble with an olive mic. */
const VOICE_ITEM: ArchEntry = {
  kind: 'voice',
  label: 'Tell me',
  icon: Mic,
  tint: 'surface',
  iconColor: 'sageInk',
};
const KIND_ITEMS: ArchEntry[] = LOG_KINDS.map((item) => ({ ...item, iconColor: 'ink' }));
const [FOOD_ITEM, SYMPTOMS_ITEM, MEDICATION_ITEM] = KIND_ITEMS as [ArchEntry, ArchEntry, ArchEntry];

/** Where each button sits on the arch, in degrees around the Log button: the outer two low, the inner two higher. */
const ANGLE: Record<ArchKind, number> = { food: 143.5, symptoms: 106, voice: 74, medication: 36.5 };
const ITEMS = [FOOD_ITEM, SYMPTOMS_ITEM, VOICE_ITEM, MEDICATION_ITEM].map((item) => ({
  ...item,
  angle: ANGLE[item.kind],
}));

/** The arch's radius around the Log button's centre, and the size of each round button on it. */
const RADIUS = 138;
const BUTTON = 56;
const LABEL_WIDTH = 96;
/** Same dim as the bottom sheets. */
const SCRIM = 'rgba(30,26,22,0.42)';
/** Critically damped: no bounce, and the same path both ways, so closing is opening played backwards. */
const SPRING = { duration: 350, dampingRatio: 1 } as const;
/** Under Reduce Motion the buttons only fade; they do not fly. */
const FADE_MS = 150;

type Props = {
  /** The screen's bottom safe-area inset, so the arch lines up with the Log button. */
  bottomInset: number;
  /** Open or closing. The arch stays mounted while it closes, and tells `onClosed` once it is gone. */
  open: boolean;
  onPick: (kind: ArchKind) => void;
  onClose: () => void;
  /** The close animation has finished, so the arch can be unmounted. */
  onClosed: () => void;
};

/**
 * Figma "02d" and "45a": tapping Log fans four round buttons (food, symptom, tell me, medication) in an arch above it, over a
 * dimmed screen. Rendered under the tab bar, so the bar and its close button stay visible and tappable. Opening and
 * closing are one spring that runs forwards and back from wherever it is, so tapping Log again mid-way reverses it.
 */
export function QuickLogArch({ bottomInset, open, onPick, onClose, onClosed }: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  /** 0 = folded into the Log button, 1 = fanned out. */
  const progress = useSharedValue(0);

  useEffect(() => {
    const to = open ? 1 : 0;
    // A reversal mid-way cancels this animation (`finished` is false), so it only reports a close that happened.
    const onEnd = (finished?: boolean) => {
      'worklet';
      if (finished && to === 0) scheduleOnRN(onClosed);
    };
    progress.value = reduceMotion
      ? withTiming(to, { duration: FADE_MS }, onEnd)
      : withSpring(to, SPRING, onEnd);
  }, [open, reduceMotion, progress, onClosed]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const centreFromBottom = tabBarHeight(bottomInset) - LOG_CENTRE_BELOW_BAR_TOP;
  return (
    // While it closes, touches fall through to the screen, and the Log button above can reopen it.
    <View pointerEvents={open ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }, scrimStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss quick log"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {ITEMS.map(({ kind, label, icon: Icon, tint, iconColor, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const dx = RADIUS * Math.cos(rad);
        const dy = RADIUS * Math.sin(rad);
        return (
          <ArchItem
            key={kind}
            progress={progress}
            reduceMotion={reduceMotion}
            dx={dx}
            dy={dy}
            left={width / 2 + dx - BUTTON / 2}
            bottom={centreFromBottom + dy - BUTTON / 2}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => onPick(kind)}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors[tint], boxShadow: shadow.softLift, opacity: pressed ? 0.85 : 1 },
              ]}>
              <Icon size={24} color={colors[iconColor]} strokeWidth={2} />
            </Pressable>
            {/* Absolute, so the button's own position is exact whatever the label's height. */}
            <AppText variant="label" color="bg" style={styles.label}>
              {label}
            </AppText>
          </ArchItem>
        );
      })}
    </View>
  );
}

type ArchItemProps = {
  progress: SharedValue<number>;
  reduceMotion: boolean;
  /** Where the button sits relative to the Log button's centre, which it flies out from. */
  dx: number;
  dy: number;
  left: number;
  bottom: number;
  children: ReactNode;
};

function ArchItem({ progress, reduceMotion, dx, dy, left, bottom, children }: ArchItemProps) {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.4, 1], [0, 1, 1]);
    if (reduceMotion) return { opacity: progress.value };
    return {
      opacity,
      // Each button flies out from the Log button's centre to its place on the arch.
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [-dx, 0]) },
        { translateY: interpolate(progress.value, [0, 1], [dy, 0]) },
        { scale: interpolate(progress.value, [0, 1], [0.4, 1]) },
      ],
    };
  });
  return <Animated.View style={[styles.item, { left, bottom }, style]}>{children}</Animated.View>;
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
