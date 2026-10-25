import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OptionRow } from '@/components/OptionRow';
import { formatWindow } from '@/lib/clock';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { DEFAULT_REMINDER_MINUTES, REMINDER_OPTIONS } from '@/lib/reminderTiming';
import { space } from '@/theme';

import { StepLayout } from './StepLayout';

type Props = {
  /** What was chosen the last time they were here (coming back); null means "No reminders". */
  initial: number | null;
  /** The minutes chosen, or null for no reminders. Nothing is asked of the phone yet. */
  onNext: (minutes: number | null) => void;
};

/**
 * When Bellie should check in after a meal (Figma 01h). Two hours is chosen to start. This only records the choice; the
 * phone's permission prompt comes on the next screen. "No reminders" is saved as asked, so the Today sheet doesn't nag.
 */
export function RemindersStep({ initial, onNext }: Props) {
  const { update } = useSettings();
  const [choice, setChoice] = useState<number | null>(initial);
  const [saveFailed, setSaveFailed] = useState(false);

  const next = () => {
    if (choice === null) {
      try {
        update('reminderAsked', true);
        update('checkInReminderMinutes', null);
      } catch (error) {
        logger.error('saveReminders', error);
        setSaveFailed(true);
        return;
      }
    }
    onNext(choice);
  };

  return (
    <StepLayout
      title="When should Bellie check in?"
      subtitle="A short nudge after a meal, to ask how you feel."
      saveFailed={saveFailed}
      footer={<Button label="Continue" onPress={next} />}>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {REMINDER_OPTIONS.map((minutes) => (
          <OptionRow
            key={minutes}
            label={`${formatWindow(minutes)} after I eat`}
            selected={choice === minutes}
            onPress={() => setChoice(minutes)}
          />
        ))}
        <OptionRow label="No reminders" selected={choice === null} onPress={() => setChoice(null)} />
      </View>
      <AppText variant="caption" color="inkSoft" style={styles.hint}>
        {`${formatWindow(DEFAULT_REMINDER_MINUTES)} is a good start. It stays on your phone, and you can change it any time in Settings.`}
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s1_5 },
  hint: { marginTop: space.s2 },
});
