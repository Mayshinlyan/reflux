import { type ReactNode, useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useColors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has finished closing (use to navigate without pushing under a closing modal). */
  onDismissed?: () => void;
  children: ReactNode;
};

/** Slide-out duration of the built-in modal animation, used where the platform has no dismiss callback. */
const ANDROID_CLOSE_MS = 300;

/** The mockup's bottom sheet: a scrim, a rounded surface with a handle, content that scrolls if long. */
export function BottomSheet({ visible, onClose, onDismissed, children }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wasVisible = useRef(false);
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
      statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.s3) },
          ]}
          accessibilityViewIsModal>
          <View style={[styles.handle, { backgroundColor: colors.hairline }]} />
          <ScrollView bounces={false}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,26,22,0.42)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
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
