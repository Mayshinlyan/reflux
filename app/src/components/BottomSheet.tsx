import { type ReactNode, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Slide-out duration of the built-in modal animation, used where the platform has no dismiss callback. */
const ANDROID_CLOSE_MS = 300;

/** The mockup's bottom sheet: a scrim, a rounded surface with a handle, content that scrolls if long. */
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
  const wasVisible = useRef(false);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopKey]);
  // Held in a ref so a parent that passes a new function every render can't cancel the timer below.
  const dismissedRef = useRef(onDismissed);
  useEffect(() => {
    dismissedRef.current = onDismissed;
  }, [onDismissed]);

  // Modal's onDismiss is iOS-only, so on Android fire it after the slide-out time.
  useEffect(() => {
    const justClosed = wasVisible.current && !visible;
    wasVisible.current = visible;
    if (!justClosed || Platform.OS === 'ios') return;
    const timer = setTimeout(() => dismissedRef.current?.(), ANDROID_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismissed}
      statusBarTranslucent
      navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors[tone], paddingBottom: Math.max(insets.bottom, space.s3) },
          ]}
          accessibilityViewIsModal>
          <View style={[styles.handle, { backgroundColor: colors.hairline }]} />
          <ScrollView ref={scroll} bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Side padding of the sheet, so content inside can size itself to the room left. */
export const SHEET_GUTTER = 20;

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,26,22,0.42)' },
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
