import { Camera, ChevronDown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TimelineItem } from '@/components/TimelineItem';
import { VerdictBadge } from '@/components/VerdictBadge';
import { radius, space, useColors } from '@/theme';

import { StepLayout } from './StepLayout';

const noop = () => {};

/** Shows what logging a meal looks like: a photo becomes a result with a verdict (Figma 01b.1). A picture, not a control. */
export function HowItWorksStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  return (
    <StepLayout
      title="Log a meal in seconds."
      subtitle="Snap a photo or type a few words. I'll tell you how it might sit."
      footer={<Button label="Continue" onPress={onNext} />}>
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
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  demo: { alignItems: 'center', gap: space.s2 },
  tag: { alignSelf: 'flex-start' },
  photo: {
    alignSelf: 'stretch',
    height: 140,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
  },
  row: { alignSelf: 'stretch' },
});
