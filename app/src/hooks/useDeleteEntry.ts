import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useToast } from '@/components/Toast';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { type DeletedEntry, deleteEntry, restoreEntry } from '@/db/repositories/entries';
import { notifyEntriesChanged } from '@/lib/entriesChanged';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { TimelineKind } from '@/lib/timeline';
import { cancelCheckIn, scheduleCheckIn } from '@/services/reminders';

/**
 * Deletes an entry at once, says so in a toast with an Undo, and calls `onDeleted`. No "are you sure?": a slip is
 * forgiven by Undo for a few seconds instead. Shared by History's swipe and the Entry screen's menu so both say and
 * do the same thing.
 */
export function useDeleteEntry(onDeleted: () => void) {
  const db = useDb();
  const toast = useToast();
  const { settings } = useSettings();

  const undo = useCallback(
    (deleted: DeletedEntry) => {
      try {
        restoreEntry(db, deleted);
      } catch (error) {
        logger.error('restoreEntry', error);
        Alert.alert("Couldn't undo", friendlyMessages.INTERNAL);
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      notifyEntriesChanged();
      if (deleted.kind === 'food' && settings.checkInReminderMinutes !== null) {
        void scheduleCheckIn({
          mealId: deleted.log.id,
          mealName: deleted.log.mealName,
          eatenAt: new Date(deleted.log.loggedAt),
          minutes: settings.checkInReminderMinutes,
          bedtime: settings.bedtime,
        });
      }
    },
    [db, settings.checkInReminderMinutes, settings.bedtime],
  );

  return useCallback(
    (entry: { kind: TimelineKind; id: number }) => {
      let deleted: DeletedEntry | undefined;
      try {
        deleted = deleteEntry(db, entry);
      } catch (error) {
        logger.error('deleteEntry', error);
        Alert.alert("Couldn't delete", friendlyMessages.INTERNAL);
        return;
      }
      if (entry.kind === 'food') void cancelCheckIn(entry.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      onDeleted();
      // Already gone (deleted from elsewhere): nothing to undo.
      if (!deleted) return;
      const gone = deleted;
      toast('Entry deleted', { action: { label: 'Undo', onPress: () => undo(gone) } });
    },
    [db, toast, undo, onDeleted],
  );
}
