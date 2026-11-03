import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { TimelineItem } from '@/components/TimelineItem';
import { VerdictBadge } from '@/components/VerdictBadge';
import { cardEdge, radius, space, useColors } from '@/theme';

import { StepLayout } from './StepLayout';

const noop = () => {};

/**
 * Shows what the app does in one screen (Figma 17b): a logged meal with a verdict, and the pattern that builds up as
 * you log more. Both are pictures marked "Example", not controls, and carry no made-up numbers.
 */
export function HowItWorksStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  return (
    <StepLayout title="Log a meal. Spot the patterns." footer={<Button label="Continue" onPress={onNext} />}>
      <View style={styles.stack}>
        <View
          accessible
          accessibilityLabel="Example: a logged meal with a result, here Spicy chicken tacos with a Caution verdict"
          pointerEvents="none"
          style={styles.demo}>
          <AppText variant="label" color="inkSoft">
            Example
          </AppText>
          <TimelineItem
            kind="food"
            title="Spicy chicken tacos"
            time="7:40 PM"
            onPress={noop}
            side={<VerdictBadge verdict="caution" />}
          />
        </View>

        <View
          accessible
          accessibilityLabel="Example: Spicy meals. Heartburn often showed up within 2 hours."
          style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <View style={styles.head}>
            <AppText variant="displaySmall" style={styles.headText}>
              Spicy meals
            </AppText>
            <Belly mood="caution" size={72} />
          </View>
          <AppText color="inkSoft">Heartburn often showed up within 2 hours.</AppText>
        </View>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s3 },
  demo: { gap: space.s2 },
  card: { padding: space.s3 - 4, borderRadius: radius.lg, gap: space.s1 + 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 - 4 },
  headText: { flex: 1 },
});
