import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { space } from '@/theme';

type Props = {
  /** Opens Food capture over Today. */
  onLog: () => void;
  /** Goes straight to Today. */
  onSkip: () => void;
};

/**
 * The last step of setup (Figma 17i): Bellie happy, an invitation to log a first meal, "Log a meal" to do it now and
 * a quiet "Skip for now". It has no progress bar, since setup is done; it hands over to logging.
 */
export function FirstMealStep({ onLog, onSkip }: Props) {
  return (
    <>
      <View style={styles.center}>
        <Belly mood="happy" size={160} />
        <AppText variant="display" accessibilityRole="header" style={styles.text}>
          Let&apos;s log your first meal
        </AppText>
        <AppText variant="voiceSmall" color="inkSoft" style={styles.text}>
          Anything you ate today. Bellie will tell you how it sits.
        </AppText>
      </View>
      <View style={styles.footer}>
        <Button label="Log a meal" onPress={onLog} />
        <Button variant="quiet" label="Skip for now" onPress={onSkip} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.s3 },
  text: { textAlign: 'center' },
  footer: { paddingTop: space.s2, paddingBottom: space.s3, gap: space.s1 },
});
