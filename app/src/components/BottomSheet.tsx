import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { space, useColors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has finished closing (use to navigate without pushing under a closing modal). */
  onDismissed?: () => void;
  /** When this changes the sheet scrolls back to the top, e.g. when it swaps from viewing to editing. */
  scrollToTopKey?: unknown;
  /** The sheet's fill: `surface` (default), or the page `bg` when the content sits on `surface` cards (Figma 08b, 08c). */
  tone?: 'surface' | 'bg';
  children: ReactNode;
};

/** Critically damped, so it settles without a bounce; started from wherever the sheet is, so it can be interrupted. */
const SPRING = { duration: 320, dampingRatio: 1 } as const;
/** Under Reduce Motion the sheet fades in and out instead of sliding. */
const FADE_MS = 180;
/** A drag counts once the finger has moved this far down (pt); the sheet then follows from there. */
const DRAG_START = 8;
/** Where a drag would come to rest if the finger let go now, seconds of velocity ahead. */
const PROJECT_S = 0.2;
/** Let go past this share of the sheet's height (after projecting) and it closes; otherwise it springs back. */
const CLOSE_AT = 0.4;

/**
 * The mockup's bottom sheet: a scrim that fades, a rounded surface with a handle, content that scrolls if long.
 * The sheet follows a finger dragged down on it (from its top, or anywhere once its content is scrolled to the top)
 * and closes on a flick or a long enough drag. Every move is a spring from the current position, so reopening it
 * mid-close turns it round without a jump. (A sheet grabbed while it is closing keeps sliding away under the finger.)
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  scrollToTopKey,
  tone = 'surface',
  children,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height: screenHeight } = useWindowDimensions();
  const wasVisible = useRef(false);
  const scroll = useRef<ScrollView>(null);
  // The Modal stays up while the sheet animates out; `visible` only says where it is headed.
  const [seenVisible, setSeenVisible] = useState(visible);
  const [closing, setClosing] = useState(false);
  if (visible !== seenVisible) {
    setSeenVisible(visible);
    setClosing(!visible);
  }
  const mounted = visible || closing;
  /** 0 = off screen, 1 = in place. */
  const open = useSharedValue(0);
  /** How far a finger has pulled the sheet down from its place (pt, never negative). */
  const drag = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const touchStartY = useSharedValue(0);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopKey]);
  // Held in refs so a parent that passes a new function every render can't cancel or double the calls below.
  const dismissedRef = useRef(onDismissed);
  const closeRef = useRef(onClose);
  useEffect(() => {
    dismissedRef.current = onDismissed;
    closeRef.current = onClose;
  }, [onDismissed, onClose]);

  const finishClose = useCallback(() => {
    setClosing(false);
    // Modal's onDismiss is iOS-only, so elsewhere the end of the slide-out is the signal.
    if (Platform.OS !== 'ios') dismissedRef.current?.();
  }, []);
  const requestClose = useCallback(() => closeRef.current(), []);

  useEffect(() => {
    if (visible) {
      wasVisible.current = true;
      drag.value = 0;
      open.value = reduceMotion ? withTiming(1, { duration: FADE_MS }) : withSpring(1, SPRING);
      return;
    }
    if (!wasVisible.current) return;
    wasVisible.current = false;
    Keyboard.dismiss();
    // A reopen mid-slide cancels this animation (`finished` is false), so the Modal is only dropped when it ends.
    const onEnd = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(finishClose);
    };
    open.value = reduceMotion ? withTiming(0, { duration: FADE_MS }, onEnd) : withSpring(0, SPRING, onEnd);
  }, [visible, reduceMotion, open, drag, finishClose]);

  // Takes over from the scroll only when the content is at the top and the finger is going down.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((event) => {
          touchStartY.set(event.allTouches[0]?.absoluteY ?? 0);
        })
        .onTouchesMove((event, state) => {
          const dy = (event.allTouches[0]?.absoluteY ?? 0) - touchStartY.get();
          if (dy > DRAG_START && scrollY.get() <= 0) state.activate();
          else if (Math.abs(dy) > DRAG_START) state.fail();
        })
        .onUpdate((event) => {
          drag.set(Math.max(0, event.translationY - DRAG_START));
        })
        // `requestClose` reads a ref, but only when the finger lifts, never during render. Keeping it (rather than
        // `onClose`, a new function on most renders) leaves the gesture alone, so a drag is never rebuilt mid-way.
        // eslint-disable-next-line react-hooks/refs
        .onEnd((event) => {
          const projected = drag.get() + event.velocityY * PROJECT_S;
          if (projected > sheetHeight.get() * CLOSE_AT) {
            const onClosed = (finished?: boolean) => {
              'worklet';
              if (finished) scheduleOnRN(finishClose);
            };
            // The slide out starts here, not from the parent hiding the sheet: a sheet grabbed while it was already
            // closing has no prop change left to restart it, and would otherwise be left half open with the Modal up.
            if (reduceMotion) {
              open.set(withTiming(0, { duration: FADE_MS }, onClosed));
            } else {
              // Hand the sheet's real position (the finger's, plus any slide-out still under way) to `open`.
              const y = (1 - open.get()) * screenHeight + drag.get();
              open.set(Math.max(0, 1 - y / screenHeight));
              drag.set(0);
              open.set(withSpring(0, SPRING, onClosed));
            }
            scheduleOnRN(requestClose);
          } else {
            drag.set(withSpring(0, { ...SPRING, velocity: event.velocityY }));
          }
        }),
    [touchStartY, scrollY, drag, open, sheetHeight, screenHeight, reduceMotion, finishClose, requestClose],
  );

  const sheetStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: open.value, transform: [{ translateY: drag.value }] }
      : { transform: [{ translateY: (1 - open.value) * screenHeight + drag.value }] },
  );
  // The scrim follows the sheet's own position, so it fades rather than riding up with it.
  const scrimStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: open.value };
    const y = (1 - open.value) * screenHeight + drag.value;
    return { opacity: 1 - Math.min(1, Math.max(0, y / Math.max(sheetHeight.value, 1))) };
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismissed}
      statusBarTranslucent
      navigationBarTranslucent>
      {/* A Modal is its own native window, so gestures inside it need their own root. */}
      <GestureHandlerRootView style={styles.fill}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </Animated.View>
          <GestureDetector gesture={pan}>
            <Animated.View
              onLayout={(event: LayoutChangeEvent) => {
                sheetHeight.set(event.nativeEvent.layout.height);
              }}
              style={[
                styles.sheet,
                { backgroundColor: colors[tone], paddingBottom: Math.max(insets.bottom, space.s3) },
                sheetStyle,
              ]}
              accessibilityViewIsModal>
              <View style={[styles.handle, { backgroundColor: colors.hairline }]} />
              <ScrollView
                ref={scroll}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={(event) => {
                  scrollY.set(event.nativeEvent.contentOffset.y);
                }}>
                {children}
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Side padding of the sheet, so content inside can size itself to the room left. */
export const SHEET_GUTTER = 20;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(30,26,22,0.42)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SHEET_GUTTER,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: space.s2,
  },
});
