import { Camera, ChevronDown } from 'lucide-react-native';
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
 * Shows what the app does in one screen (Figma 17b): a photo becomes a result with a verdict, and the more you
 * log the clearer a pattern gets. Both are pictures marked "Example", not controls, and carry no made-up numbers.
 */
export function HowItWorksStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  return (
    <StepLayout
      title="Log a meal. Spot the patterns."
      subtitle="Snap a photo or type a few words. I'll tell you how it might sit."
      footer={<Button label="Continue" onPress={onNext} />}>
      <View style={styles.stack}>
        <View
          accessible
          accessibilityLabel="Example: a photo of your meal becomes a result, here Spicy chicken tacos with a Caution verdict"
          pointerEvents="none"
          style={styles.demo}>
          <AppText variant="label" color="inkSoft" style={styles.tag}>
            Example
          </AppText>
          <View style={[styles.photo, { backgroundColor: colors.surface2 }]}>
            <Camera size={32} color={colors.ink} strokeWidth={2} />
            <AppText variant="caption" color="inkSoft">
              Photo of your meal
            </AppText>
          </View>
          <ChevronDown size={24} color={colors.ink} strokeWidth={2} />
          <View style={styles.row}>
            <TimelineItem
              kind="food"
              title="Spicy chicken tacos"
              time="7:40 PM"
              onPress={noop}
              side={<VerdictBadge verdict="caution" />}
            />
          </View>
        </View>

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
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s3 },
  demo: { alignItems: 'center', gap: space.s2 },
  tag: { alignSelf: 'flex-start' },
  photo: {
    alignSelf: 'stretch',
    minHeight: 76,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
  },
  row: { alignSelf: 'stretch' },
  card: { padding: space.s3 - 4, borderRadius: radius.lg, gap: space.s1 + 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 - 4 },
  headText: { flex: 1, gap: 4 },
});
