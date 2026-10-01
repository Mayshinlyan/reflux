import { router } from 'expo-router';

/**
 * Swipe navigation between the log screens: Today → Food → Symptoms → Medication. A left swipe moves
 * forward and a right swipe back one screen (from Food, back to wherever it was opened). Moving between
 * log screens replaces the current one, so Back from any of them still returns to where the user came from.
 */
const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

export const foodSwipe = { onSwipeLeft: () => router.replace('/log/symptoms'), onSwipeRight: back };
export const symptomsSwipe = {
  onSwipeLeft: () => router.replace('/log/medication'),
  onSwipeRight: () => router.replace('/log/food'),
};
export const medicationSwipe = { onSwipeRight: () => router.replace('/log/symptoms') };
