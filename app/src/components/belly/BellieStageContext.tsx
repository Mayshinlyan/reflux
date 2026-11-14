import { createContext, type ReactNode, useContext } from 'react';

import { useSettings } from '@/db/DatabaseProvider';
import { type BellieStage, isBellieStage } from '@/lib/bellieStage';
import { type ItemKey, wornNow } from '@/lib/bellieItems';

// Without a provider (a test, a screen outside the app) Bellie is the "Little", the everyday one in the mood drawings,
// and wears nothing.
const BellieStageContext = createContext<BellieStage>('little');
const NOTHING: readonly ItemKey[] = [];
const BellieWornContext = createContext<readonly ItemKey[]>(NOTHING);

/** The stage Bellie is drawn at everywhere: the newest one whose "Bellie grew" page was seen. */
export function useBellieStage(): BellieStage {
  return useContext(BellieStageContext);
}

/** What Bellie wears everywhere (Customize Bellie). */
export function useBellieWorn(): readonly ItemKey[] {
  return useContext(BellieWornContext);
}

export function BellieStageProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  // A stored value that is not a stage (a corrupt row) is a Baby, the first stage.
  const stage = isBellieStage(settings.bellieStageSeen) ? settings.bellieStageSeen : 'baby';
  const worn = wornNow(settings.bellieWorn, settings.bellieHat);
  return (
    <BellieStageContext.Provider value={stage}>
      <BellieWornContext.Provider value={worn}>{children}</BellieWornContext.Provider>
    </BellieStageContext.Provider>
  );
}
