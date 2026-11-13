import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { LogKind } from '@/lib/completionFlow';
import { statLineFor, subtitleFor, titleFor } from '@/lib/completionFlow';
import type { CheckInSummary } from '@/lib/streak';
import { space } from '@/theme';

import { CompletionLayout } from './CompletionLayout';
import { Confetti } from './Confetti';
import { HoppingBelly } from './HoppingBelly';

type Props = {
  kind: LogKind;
  summary: CheckInSummary;
  /** The dose's name and time ("Metformin, 8:30 am"). */
  note?: string;
  /** "Add details" (meal, symptoms) or "Change time" (dose); left out when there is nothing to open. */
  quiet?: { label: string; onPress: () => void };
  onContinue: () => void;
};

/** Screen 1 (Figma G1): shown after every log. Bellie hops, confetti, one line, a Continue button. */
export function CompletionPage({ kind, summary, note, quiet, onContinue }: Props) {
  return (
    <CompletionLayout
      backdrop={<Confetti />}
      action={{ label: 'Continue', onPress: onContinue }}
      quiet={quiet}>
      <HoppingBelly hop shadow />
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        {titleFor(kind)}
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        {subtitleFor(kind, note)}
      </AppText>
      <View style={styles.stat}>
        <AppText variant="small" color="inkSoft">
          {statLineFor(kind, summary)}
        </AppText>
      </View>
    </CompletionLayout>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.s3, textAlign: 'center' },
  line: { marginTop: space.s1, textAlign: 'center' },
  stat: { marginTop: space.s3 },
});
