import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useDb } from '@/db/DatabaseProvider';
import { countLoggedEntries } from '@/db/repositories/data';
import { coinGain, coinsForLogs } from '@/lib/coins';
import { logger } from '@/lib/logger';

/**
 * The coin balance, re-counted each time Today gains focus. `gain` is how many coins were
 * earned since Today last showed the balance (e.g. a log was just saved), and `gainId`
 * changes with every new gain so the counter can celebrate each one exactly once.
 */
export function useCoins(): { coins: number; gain: number; gainId: number } {
  const db = useDb();
  const shown = useRef<number | null>(null);
  const [state, setState] = useState({ coins: 0, gain: 0, gainId: 0 });

  useFocusEffect(
    useCallback(() => {
      try {
        const coins = coinsForLogs(countLoggedEntries(db));
        const gain = coinGain(shown.current, coins);
        shown.current = coins;
        setState((prev) => ({ coins, gain, gainId: gain > 0 ? prev.gainId + 1 : prev.gainId }));
      } catch (error) {
        // Coins are decorative: on a read failure keep showing the last balance.
        logger.error('loadCoins', error);
      }
    }, [db]),
  );

  return state;
}
