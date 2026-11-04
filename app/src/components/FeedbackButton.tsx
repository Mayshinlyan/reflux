import * as Haptics from 'expo-haptics';
import { MessageSquareText } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePressScale } from '@/hooks/usePressScale';
import { radius, shadow, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { FeedbackSheet } from './FeedbackSheet';
import { tabBarHeight } from './FloatingTabBar';
import { useToast } from './Toast';

/** How tall the pill is (Figma row 27); the tap area adds 4 above and below to reach 44. */
const PILL_HEIGHT = 36;
const ICON_SIZE = 18;

/** From the screen's bottom edge to the top of the pill: over the tab bar, with a small gap. */
const bottomOffset = (bottomInset: number) => tabBarHeight(bottomInset) + space.s1;

/** What a scrolling list under the button needs as bottom padding so its last row clears the pill. */
export const feedbackButtonClearance = (bottomInset: number) =>
  bottomOffset(bottomInset) + PILL_HEIGHT + space.s1;

/**
 * Figma row 27: a small "Feedback" pill at the lower right, just above the tab bar, that opens the same sheet as
 * Settings, About, "Send feedback". The pill floats over the screen, so the screen adds `feedbackButtonClearance`
 * to its list's bottom padding.
 */
export function FeedbackButton() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const press = usePressScale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <View pointerEvents="box-none" style={[styles.anchor, { bottom: bottomOffset(insets.bottom) }]}>
        <Animated.View style={press.style}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Feedback"
            hitSlop={4}
            onPress={() => setOpen(true)}
            onPressIn={press.pressIn}
            onPressOut={press.pressOut}
            style={[styles.pill, { backgroundColor: colors.surface, boxShadow: shadow.softLift }]}>
            <MessageSquareText size={ICON_SIZE} color={colors.ink} strokeWidth={2} />
            <AppText variant="label" accessible={false}>
              Feedback
            </AppText>
          </Pressable>
        </Animated.View>
      </View>
      <FeedbackSheet
        visible={open}
        onClose={() => setOpen(false)}
        onSent={() => {
          setOpen(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          toast('Thanks, Bellie got it');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: space.s3 },
  // The icon-to-label gap (6) and the side padding (14 left, 16 right, which balances the icon's own space) are
  // Figma row 27's own measures, not steps of the 8pt grid.
  pill: {
    minHeight: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: radius.pill,
  },
});
