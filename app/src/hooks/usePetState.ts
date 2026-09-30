import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { listMedicationLogs } from '@/db/repositories/medications';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import { logger } from '@/lib/logger';
import { derivePetState, type PetState } from '@/lib/petProgress';

const ALL_TIME = { from: '0000-01-01T00:00:00.000Z', to: '9999-12-31T23:59:59.999Z' };
const NEW_PET: PetState = { stage: 0, progress: 0, mood: 'happy' };

/**
 * The pet's current stage, progress and mood, replayed from every log each time Today
 * gains focus (so a save, edit or delete elsewhere is reflected on return).
 */
export function usePetState(): PetState & { hasLogs: boolean } {
  const db = useDb();
  const { settings } = useSettings();
  const [state, setState] = useState<PetState & { hasLogs: boolean }>({ ...NEW_PET, hasLogs: false });

  useFocusEffect(
    useCallback(() => {
      try {
        const food = listDiaryFoodLogs(db, ALL_TIME);
        const symptoms = listSymptomLogs(db, ALL_TIME);
        const medications = listMedicationLogs(db, ALL_TIME);
        const derived = derivePetState(
          {
            food: food.map((log) => ({
              loggedAt: log.loggedAt,
              tz: log.tz,
              verdict: log.overallVerdict,
            })),
            symptoms: symptoms.map((log) => ({
              loggedAt: log.loggedAt,
              scores: log.items.map((item) => item.score),
            })),
            medications: medications.map((log) => ({ takenAt: log.takenAt })),
          },
          settings.bedtime,
          settings.lateMealWindowMinutes,
        );
        setState({
          ...derived,
          hasLogs: food.length + symptoms.length + medications.length > 0,
        });
      } catch (error) {
        // The pet is decorative: on a read failure keep showing the last state.
        logger.error('loadPetState', error);
      }
    }, [db, settings.bedtime, settings.lateMealWindowMinutes]),
  );

  return state;
}
