import { X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { minTouchTarget, space, useColors } from '@/theme';

import { type Placement, TAIL_HEIGHT, TAIL_WIDTH } from './layout';

type Props = {
  /** 1-based, for "2 OF 7". */
  number: number;
  total: number;
  title: string;
  body: string;
  placement: Placement;
  /** The card's measured height, so a tail under it can be placed. */
  height: number;
  reduceMotion: boolean;
  /** No Back on the first step. */
  onBack?: () => void;
  onNext: () => void;
  onClose: () => void;
  onHeight: (height: number) => void;
};

/**
 * Figma row 18 "App tour": a white card with an "N OF M" label, a title, a line of help, a close button, Back and
 * Next (Done on the last step), and a tail pointing at the cut-out. It fades in on every step.
 */
export function CoachMark({
  number,
  total,
  title,
  body,
  placement,
  height,
  reduceMotion,
  onBack,
  onNext,
  onClose,
  onHeight,
}: Props) {
  const colors = useColors();
  const titleRef = useRef<ViewInstance>(null);
  const last = number === total;

  // A screen reader lands on each new step's title.
  useEffect(() => {
    const target = titleRef.current;
    if (target) AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
  }, [number]);

  const { tail } = placement;
  return (
    <Animated.View
      key={number}
      entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.duration(220)}
      style={styles.layer}
      pointerEvents="box-none">
      <View
        onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)}
        style={[
          styles.card,
          {
            left: placement.left,
            width: placement.width,
            top: placement.top,
            backgroundColor: colors.surface,
          },
        ]}>
        <View style={styles.header}>
          <AppText
            variant="label"
            color="cta"
            accessibilityLabel={`Step ${number} of ${total}`}
            style={styles.count}>
            {`${number} OF ${total}`}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close tour"
            onPress={onClose}
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: colors.surface2, opacity: pressed ? 0.85 : 1 },
            ]}>
            <X size={18} color={colors.inkSoft} strokeWidth={2} />
          </Pressable>
        </View>
        <View ref={titleRef} accessible accessibilityRole="header">
          <AppText variant="section">{title}</AppText>
        </View>
        <AppText variant="small" color="inkSoft">
          {body}
        </AppText>
        <View style={styles.buttons}>
          {onBack && <Button label="Back" variant="secondary" onPress={onBack} />}
          <Button label={last ? 'Done' : 'Next'} onPress={onNext} />
        </View>
      </View>
      {tail && (
        <Svg
          width={TAIL_WIDTH}
          height={TAIL_HEIGHT}
          style={[
            styles.tail,
            {
              left: tail.left,
              // One point inside the card, so it joins it without a seam.
              top: tail.side === 'below' ? placement.top - TAIL_HEIGHT + 1 : placement.top + height - 1,
            },
          ]}>
          <Polygon points={tailPoints(tail.side)} fill={colors.surface} />
        </Svg>
      )}
    </Animated.View>
  );
}

/** A triangle pointing up (card below its target) or down (card above it). */
const tailPoints = (side: 'above' | 'below') =>
  side === 'below'
    ? `0,${TAIL_HEIGHT} ${TAIL_WIDTH / 2},0 ${TAIL_WIDTH},${TAIL_HEIGHT}`
    : `0,0 ${TAIL_WIDTH / 2},${TAIL_HEIGHT} ${TAIL_WIDTH},0`;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  card: {
    position: 'absolute',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: space.s1_5,
    paddingBottom: 20,
    gap: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { letterSpacing: 1 },
  close: {
    width: Math.max(minTouchTarget, 44),
    height: Math.max(minTouchTarget, 44),
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.s1_5, paddingTop: space.s1_5 },
  tail: { position: 'absolute' },
});
