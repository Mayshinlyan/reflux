import { type ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** A swipe counts once it travels this far (pt) or is flicked this fast (pt/s). */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;

type Props = {
  children: ReactNode;
  /** Finger moves left: the next screen in the log sequence. */
  onSwipeLeft?: () => void;
  /** Finger moves right: back one screen. */
  onSwipeRight?: () => void;
  /**
   * Finger moves up. Only for screens that don't scroll (Today), since it would compete with the
   * scroll view.
   */
  onSwipeUp?: () => void;
  /** Turn swipes off while a form is half-filled, so a stray drag can't drop it. */
  enabled?: boolean;
};

/**
 * Wraps a screen so horizontal swipes move between the log screens. Only a clear drag starts it, so
 * taps, vertical scrolling and swipe-to-delete rows (which claim their own touches) keep working.
 */
export function SwipeNav({ children, onSwipeLeft, onSwipeRight, onSwipeUp, enabled = true }: Props) {
  // Pass stable callbacks: a new one rebuilds the gesture, which could interrupt a drag in progress.
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(enabled)
      .activeOffsetX([-20, 20])
      .onEnd((event, success) => {
        if (!success) return;
        const { translationX: dx, translationY: dy, velocityX: vx, velocityY: vy } = event;
        if (Math.abs(dx) >= Math.abs(dy)) {
          if (dx <= -SWIPE_DISTANCE || vx <= -SWIPE_VELOCITY) onSwipeLeft?.();
          else if (dx >= SWIPE_DISTANCE || vx >= SWIPE_VELOCITY) onSwipeRight?.();
        } else if (dy <= -SWIPE_DISTANCE || vy <= -SWIPE_VELOCITY) {
          onSwipeUp?.();
        }
      })
      .withTestId('swipe-nav');
    // Without an up handler a vertical drag is left to scrolling; with one it starts the swipe.
    return onSwipeUp ? pan.activeOffsetY(-20).failOffsetY(20) : pan.failOffsetY([-20, 20]);
  }, [enabled, onSwipeLeft, onSwipeRight, onSwipeUp]);

  return (
    <GestureDetector gesture={gesture}>
      {/* A plain native view: the detector can't attach to Screen, which forwards no ref. */}
      <View style={styles.fill} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
