import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useToast } from '@/components/Toast';
import { useDb } from '@/db/DatabaseProvider';
import { deleteFoodLog } from '@/db/repositories/food';
import { deleteMedicationLog } from '@/db/repositories/medications';
import { deleteSymptomLog } from '@/db/repositories/symptoms';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { TimelineKind } from '@/lib/timeline';
import { cancelCheckIn } from '@/services/reminders';

/**
 * Asks "Delete this entry?" and, if confirmed, deletes it, says so in a toast and calls `onDeleted`. Shared by
 * History's swipe and the Entry screen's menu so both say and do the same thing.
 */
export function useDeleteEntry(onDeleted: () => void) {
  const db = useDb();
  const toast = useToast();
  return useCallback(
    (entry: { kind: TimelineKind; id: number }) => {
      Alert.alert('Delete this entry?', "It will be removed from this phone. This can't be undone.", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              if (entry.kind === 'symptom') deleteSymptomLog(db, entry.id);
              if (entry.kind === 'food') {
                deleteFoodLog(db, entry.id);
                void cancelCheckIn(entry.id);
              }
              if (entry.kind === 'medication') deleteMedicationLog(db, entry.id);
            } catch (error) {
              logger.error('deleteEntry', error);
              Alert.alert("Couldn't delete", friendlyMessages.INTERNAL);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            toast('Entry deleted');
            onDeleted();
          },
        },
      ]);
    },
    [db, toast, onDeleted],
  );
}
