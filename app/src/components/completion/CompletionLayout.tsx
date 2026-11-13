import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { minTouchTarget, space, useColors } from '@/theme';

type Props = {
  children: ReactNode;
  /** The big olive button, at the bottom. */
  action: { label: string; onPress: () => void; disabled?: boolean };
  /** A quiet text link under it ("Add details", "Not now", "Later"). */
  quiet?: { label: string; onPress: () => void };
  /** Content sits at the top (lists, bubbles) instead of centred. */
  top?: boolean;
  /** Drawn behind the content (confetti). */
  backdrop?: ReactNode;
  /** Content sits low, a fixed gap above the button, instead of floating in the middle (the completion page). */
  low?: boolean;
};

/** The shared page of the completion flow (Figma G1 to G4): content above, a full-width button and a quiet link below. */
export function CompletionLayout({ children, action, quiet, top = false, backdrop, low = false }: Props) {
  const colors = useColors();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom', 'left', 'right']}>
      {backdrop}
      <View style={[styles.body, top ? styles.top : low ? styles.low : styles.centre]}>{children}</View>
      <View style={styles.footer}>
        <Button label={action.label} onPress={action.onPress} disabled={action.disabled} />
        {/* Always reserves the link's room, so the button stays put from screen to screen. */}
        <View style={styles.quietSlot}>
          {quiet && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={quiet.label}
              onPress={quiet.onPress}
              hitSlop={8}
              style={({ pressed }) => [styles.quiet, { opacity: pressed ? 0.6 : 1 }]}>
              <AppText variant="bodyEm" color="cta">
                {quiet.label}
              </AppText>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: space.s3 },
  body: { flex: 1 },
  centre: { justifyContent: 'center', alignItems: 'center' },
  top: { paddingTop: space.s4 },
  low: { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: space.s5 },
  footer: { paddingBottom: space.s2 },
  quietSlot: { height: minTouchTarget + space.s1, justifyContent: 'center', alignItems: 'center' },
  quiet: { minHeight: minTouchTarget, justifyContent: 'center', paddingHorizontal: space.s2 },
});
