import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PotLoader } from '@/components/PotLoader';
import { cardEdge, radius, space, useColors } from '@/theme';

type Props = {
  /** 'running' while the week is being made; 'failed' when it could not be, with a way to try again. */
  status: 'running' | 'failed';
  onRetry: () => void;
};

/**
 * The Kitchen while the week plan is being made (Figma "meal planning flow" F3 and F3b): the steaming pot on top and one
 * quiet line under it, "Planning your week". If it could not be made, the line says so and an underlined "Try again"
 * takes its place. It stands where the plan card or the week would be, so the page says what is happening.
 */
export function PlanningCard({ status, onRetry }: Props) {
  const colors = useColors();
  const failed = status === 'failed';
  return (
    <View
      accessibilityRole={failed ? undefined : 'progressbar'}
      accessibilityLabel={failed ? undefined : 'Planning your week'}
      style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <PotLoader />
      <AppText variant="bodyEm" color="inkSoft" style={styles.line}>
        {failed ? 'Planning is taking too long' : 'Planning your week'}
      </AppText>
      {failed && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={onRetry}
          hitSlop={8}
          style={styles.link}>
          <AppText variant="bodyEm" style={styles.underline}>
            Try again
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, paddingVertical: space.s4, alignItems: 'center', gap: space.s2 },
  line: { textAlign: 'center' },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
