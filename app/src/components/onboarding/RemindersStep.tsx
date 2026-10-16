import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { DEFAULT_REMINDER_MINUTES } from '@/lib/reminderTiming';
import { askForReminders } from '@/services/reminders';
import { space } from '@/theme';

import { NotificationPreview } from './NotificationPreview';
import { StepLayout } from './StepLayout';

/**
 * Offers the check-in reminder (Figma 01h): turning it on asks the phone for permission and sets "about 2 hours
 * after a meal". "Maybe later" leaves it off and unasked, so the one-time sheet can still offer it on Today.
 */
export function RemindersStep({ onNext }: { onNext: () => void }) {
  const { update } = useSettings();
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    const allowed = await askForReminders();
    try {
      // Asked now, whatever they answered, so the phone's one-time prompt isn't followed by ours.
      update('reminderAsked', true);
      if (allowed) update('checkInReminderMinutes', DEFAULT_REMINDER_MINUTES);
    } catch (error) {
      logger.error('saveReminders', error);
      setSaveFailed(true);
      setBusy(false);
      return;
    }
    setBusy(false);
    onNext();
  };

  return (
    <StepLayout
      title="Want a gentle nudge?"
      subtitle="Turning on notifications helps you log how you feel after meals, so your patterns show up sooner."
      saveFailed={saveFailed}
      footer={
        <>
          <Button label="Turn on notifications" onPress={turnOn} disabled={busy} />
          <Button label="Maybe later" variant="secondary" onPress={onNext} disabled={busy} />
        </>
      }>
      <NotificationPreview />
      <AppText variant="caption" color="inkSoft" style={styles.hint}>
        About 2 hours after a meal. It stays on your phone, and you can change it any time in Settings.
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: space.s2 },
});
