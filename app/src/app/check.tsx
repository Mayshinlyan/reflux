import { FoodFlow } from '@/components/FoodFlow';

/** Check a food before eating it; "I ate this" moves the check into the diary. */
export default function CheckScreen() {
  return <FoodFlow mode="check" />;
}
