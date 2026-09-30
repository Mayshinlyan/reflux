import { Trash2 } from 'lucide-react-native';
import { type ReactNode, useRef } from 'react';
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  /** What the row is, for the Delete button's screen-reader label ("Delete Mint tea"). */
  label: string;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A row that reveals a Delete button when swiped left. Only left swipes are handled, so a swipe right is free
 * for navigation. The row itself should also offer Delete as an accessibility action, since screen readers
 * can't swipe.
 */
export function SwipeToDelete({ label, onDelete, style, children }: Props) {
  const colors = useColors();
  const swipeable = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      overshootRight={false}
      rightThreshold={40}
      containerStyle={style}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${label}`}
          onPress={() => {
            swipeable.current?.close();
            onDelete();
          }}
          style={[styles.action, { backgroundColor: colors.cta }]}>
          <Trash2 size={20} color={colors.ctaInk} strokeWidth={2.2} />
          <AppText style={[styles.actionText, { color: colors.ctaInk }]}>Delete</AppText>
        </Pressable>
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 88,
    minHeight: minTouchTarget,
    marginLeft: space.s1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionText: { ...typography.label, fontSize: 13 },
});
