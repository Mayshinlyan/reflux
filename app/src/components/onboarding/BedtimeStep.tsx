import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OptionRow } from '@/components/OptionRow';
import { useSettings } from '@/db/DatabaseProvider';
import { formatClock } from '@/lib/clock';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

import { StepLayout } from './StepLayout';

/** The common bedtimes, "HH:MM". Any half hour from 8:00 PM to 2:00 AM can be set later in Settings. */
export const BEDTIME_CHOICES = ['21:30', '22:30', '23:30', '00:30'] as const;
const DEFAULT_CHOICE = '22:30';

/**
 * When they go to bed (Figma 17f), so a meal eaten close to it can be tagged as late. 10:30 PM is chosen to start,
 * which is also the saved default, so Continue only writes when they pick something else.
 */
export function BedtimeStep({ onNext }: { onNext: () => void }) {
  const { settings, update } = useSettings();
  const [choice, setChoice] = useState<string>(settings.bedtime);
  const [saveFailed, setSaveFailed] = useState(false);

  const next = () => {
    if (choice !== settings.bedtime) {
      try {
        update('bedtime', choice);
      } catch (error) {
        logger.error('saveBedtime', error);
        setSaveFailed(true);
        return;
      }
    }
    onNext();
  };

  return (
    <StepLayout
      title="When do you go to bed?"
      subtitle="I tag meals eaten close to it as late."
      saveFailed={saveFailed}
      footer={<Button label="Continue" onPress={next} />}>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {BEDTIME_CHOICES.map((time) => (
          <OptionRow
            key={time}
            label={formatClock(time)}
            selected={choice === time}
            onPress={() => setChoice(time)}
          />
        ))}
      </View>
      <AppText variant="caption" color="inkSoft" style={styles.hint}>
        {`${formatClock(DEFAULT_CHOICE)} is a good start. You can change it any time in Settings.`}
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s1_5 },
  hint: { marginTop: space.s2 },
});
