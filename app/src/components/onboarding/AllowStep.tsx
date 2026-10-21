import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useSettings } from '@/db/DatabaseProvider';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { askForReminders } from '@/services/reminders';
import { space } from '@/theme';

type Props = {
  /** How long after a meal they chose, saved only if the phone allows notifications. */
  minutes: number;
  onDone: () => void;
};

/**
 * Just a headline while the phone's own permission prompt is up (Figma 01h.1). Whatever they answer, the check-in is
 * marked as asked (so the phone's one-time prompt isn't followed by ours) and the flow moves on; the timing is saved
 * only when they allowed it.
 */
export function AllowStep({ minutes, onDone }: Props) {
  const { update } = useSettings();
  const [saveFailed, setSaveFailed] = useState(false);
  // The prompt must be asked once, not again each time a parent re-renders with new callbacks.
  const latest = useRef({ update, onDone, minutes });
  useEffect(() => {
    latest.current = { update, onDone, minutes };
  });

  useEffect(() => {
    let active = true;
    askForReminders().then((allowed) => {
      // They went back while the prompt was up: leave the flow where they put it.
      if (!active) return;
      try {
        latest.current.update('reminderAsked', true);
        if (allowed) latest.current.update('checkInReminderMinutes', latest.current.minutes);
      } catch (error) {
        logger.error('saveReminders', error);
        setSaveFailed(true);
        return;
      }
      latest.current.onDone();
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <View style={styles.center}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          Let Bellie check in after meals
        </AppText>
      </View>
      {saveFailed && (
        <View style={styles.footer}>
          <AppText color="redInk" style={styles.title}>
            {friendlyMessages.INTERNAL}
          </AppText>
          <Button label="Continue" onPress={onDone} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  title: { textAlign: 'center' },
  footer: { paddingTop: space.s2, paddingBottom: space.s3, gap: space.s1 },
});
