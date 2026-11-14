import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { bellyLayout } from '@/components/belly/stages';
import { type BellieStage, STAGE_TITLE, stageLine } from '@/lib/bellieStage';
import { space } from '@/theme';

import { CompletionLayout } from './CompletionLayout';
import { Confetti } from './Confetti';
import { HoppingBelly } from './HoppingBelly';

const BELLIE_SIZE = 264;

type Props = {
  /** The stage Bellie just reached. */
  stage: BellieStage;
  onContinue: () => void;
};

/**
 * "Bellie grew" (Figma G14): shown on the first check-in after a milestone (30, 90, 180 and 365 check-in days). Bellie
 * hops at its new size with the confetti around it, the stage in a Gaegu line, and what got it there under it.
 */
export function GrewPage({ stage, onContinue }: Props) {
  // Bellie stands on the bottom of its box, so a younger one starts lower: the confetti moves down with it.
  const confettiAnchor = 216 - bellyLayout(stage, BELLIE_SIZE).top;
  return (
    <CompletionLayout low action={{ label: 'Continue', onPress: onContinue }}>
      {/* The confetti is placed from Bellie's top (see Confetti), so it sits around it whatever the stage. */}
      <View style={styles.stage}>
        <Confetti anchor={confettiAnchor} />
        <HoppingBelly stage={stage} size={BELLIE_SIZE} hop shadow />
      </View>
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        {STAGE_TITLE[stage]}
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        {stageLine(stage)}
      </AppText>
    </CompletionLayout>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', alignItems: 'center' },
  title: { marginTop: space.s3, textAlign: 'center' },
  line: { marginTop: space.s1, textAlign: 'center' },
});
