import { router } from 'expo-router';

/** Opens the symptom screen, linked to the meal when there is one. */
export function openSymptoms(foodLogId?: number) {
  router.push(
    foodLogId === undefined
      ? '/log/symptoms'
      : { pathname: '/log/symptoms', params: { afterFood: String(foodLogId) } },
  );
}
