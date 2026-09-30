import { useLocalSearchParams } from 'expo-router';

import { FoodFlow } from '@/components/FoodFlow';

/**
 * The food screen: analyze a photo or a typed description, then "I ate this" adds it to the diary.
 * Scan on Today opens it with `?camera=1` to go straight to the camera.
 */
export default function LogFoodScreen() {
  const { camera } = useLocalSearchParams<{ camera?: string }>();
  return <FoodFlow openCamera={camera === '1'} />;
}
