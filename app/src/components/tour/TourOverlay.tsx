import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { type TargetRect, tabTargetRect } from '@/components/FloatingTabBar';

import { CoachMark } from './CoachMark';
import { holeFor, placeCard } from './layout';
import type { TourStep, TourViewId } from './steps';

/** Figma row 18: `ink` at 62% over the whole screen, with the target cut out of it. */
const SCRIM = 'rgba(58, 47, 37, 0.62)';
/** Before the first real measure the card is placed as if it were about this tall. */
const CARD_ESTIMATE = 230;
/** Lets Today finish scrolling and laying out before a view is measured. */
const MEASURE_DELAY_MS = 100;

type Size = { width: number; height: number };

type Props = {
  steps: readonly TourStep[];
  index: number;
  getView: (id: TourViewId) => View | null;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
};

/** The dimmed screen with a rounded cut-out around the target. */
function Scrim({ size, hole, radius }: { size: Size; hole: TargetRect | null; radius: number }) {
  const corner = hole ? Math.min(radius, hole.width / 2, hole.height / 2) : 0;
  return (
    <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Mask id="tour-hole">
          <Rect width={size.width} height={size.height} fill="white" />
          {hole && (
            <Rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={corner}
              ry={corner}
              fill="black"
            />
          )}
        </Mask>
      </Defs>
      <Rect width={size.width} height={size.height} fill={SCRIM} mask="url(#tour-hole)" />
    </Svg>
  );
}

/**
 * Covers the screen and the tab bar while the tour runs: the scrim, and the coach mark on the side of the cut-out
 * with more room. Today's views are measured; the tabs and the Log button are worked out from the tab bar's own sizes.
 * Taps outside the card are swallowed, so nothing underneath is touched by accident.
 */
export function TourOverlay({ steps, index, getView, onNext, onBack, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const root = useRef<View>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [measured, setMeasured] = useState<{ id: string; rect: TargetRect | null } | null>(null);
  const [cardHeight, setCardHeight] = useState(CARD_ESTIMATE);
  const step = steps[index];

  // A view on Today is measured in window coordinates, then moved into the overlay's own.
  useEffect(() => {
    if (!step || step.target?.kind !== 'view' || !size) return;
    const { id: stepId } = step;
    const viewId = step.target.id;
    // A measurement that comes back after the step changed (or the tour closed) is dropped.
    let cancelled = false;
    const timer = setTimeout(() => {
      const view = getView(viewId);
      const overlay = root.current;
      if (!view || !overlay) {
        setMeasured({ id: stepId, rect: null });
        return;
      }
      overlay.measureInWindow((originX, originY) => {
        view.measureInWindow((x, y, width, height) => {
          if (cancelled) return;
          setMeasured({
            id: stepId,
            rect: width > 0 && height > 0 ? { x: x - originX, y: y - originY, width, height } : null,
          });
        });
      });
    }, MEASURE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, size, getView]);

  // `undefined` while a view is still being measured; `null` when there is nothing to spotlight.
  let target: TargetRect | null | undefined;
  if (!step || !step.target) target = null;
  else if (step.target.kind === 'tab')
    target = size ? tabTargetRect(step.target.key, size, insets.bottom) : undefined;
  else target = measured?.id === step.id ? measured.rect : undefined;

  const hole = size && target ? holeFor(target, step?.pad ?? 0, size) : null;
  const ready = size !== null && target !== undefined;

  return (
    <View
      ref={root}
      testID="tour-overlay"
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)}
      onStartShouldSetResponder={() => true}>
      {size && <Scrim size={size} hole={hole} radius={step?.radius ?? 0} />}
      {ready && step && (
        <CoachMark
          number={index + 1}
          total={steps.length}
          title={step.title}
          body={step.body}
          placement={placeCard(hole, size, cardHeight, insets)}
          height={cardHeight}
          reduceMotion={reduceMotion}
          onBack={index > 0 ? onBack : undefined}
          onNext={onNext}
          onClose={onClose}
          onHeight={setCardHeight}
        />
      )}
    </View>
  );
}
