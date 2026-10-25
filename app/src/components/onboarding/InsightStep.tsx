import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { cardEdge, radius, space, useColors } from '@/theme';

import { StepLayout } from './StepLayout';

/** An example of the kind of pattern that shows up, clearly marked as an example (Figma 01b.2). No made-up statistics. */
export function InsightStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  return (
    <StepLayout
      title="Patterns show up as you log."
      subtitle="The more you log, the clearer it gets."
      footer={<Button label="Continue" onPress={onNext} />}>
      <View
        accessible
        accessibilityLabel="Example: Spicy meals. Heartburn often showed up within 2 hours."
        style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <AppText variant="label" color="inkSoft">
              Example
            </AppText>
            <AppText variant="displaySmall">Spicy meals</AppText>
          </View>
          <Belly mood="caution" size={72} />
        </View>
        <AppText color="inkSoft">Heartburn often showed up within 2 hours.</AppText>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.s3 - 4, borderRadius: radius.lg, gap: space.s1 + 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 - 4 },
  headText: { flex: 1, gap: 4 },
});
