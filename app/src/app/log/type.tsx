import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

import { SwitchKindProvider } from '@/components/LogKindSwitcher';
import type { LogKind } from '@/lib/logKinds';

import LogFoodScreen from './food';
import LogSymptomsScreen from './symptoms';
import MedicationScreen from './medication';

/**
 * "Type" on the quick log arch (Figma 48): one modal that holds Food, How I feel and Medication as tabs. Switching
 * swaps the screen inside it, so nothing navigates and nothing animates, and it opens on Food. Each screen still reads
 * `?date=` (a day tapped in Today's week strip) from this route, and draws its own Back row with the tabs under it.
 */
export default function LogTypeScreen() {
  const navigation = useNavigation();
  const [kind, setKind] = useState<LogKind>('food');

  // Each screen turns the swipe-down off once something is entered; a fresh tab starts with it on again.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: true });
  }, [navigation, kind]);

  return (
    <SwitchKindProvider onSwitch={setKind}>
      {kind === 'food' ? (
        <LogFoodScreen />
      ) : kind === 'symptoms' ? (
        <LogSymptomsScreen />
      ) : (
        <MedicationScreen />
      )}
    </SwitchKindProvider>
  );
}
