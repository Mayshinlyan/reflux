import { createContext, type ReactNode, useContext } from 'react';

import { useSettings } from '@/db/DatabaseProvider';
import { type BellieStage, isBellieStage } from '@/lib/bellieStage';

// Without a provider (a test, a screen outside the app) Bellie is the "Little", the everyday one in the mood drawings.
const BellieStageContext = createContext<BellieStage>('little');

/** The stage Bellie is drawn at everywhere: the newest one whose "Bellie grew" page was seen. */
export function useBellieStage(): BellieStage {
  return useContext(BellieStageContext);
}

export function BellieStageProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  // A stored value that is not a stage (a corrupt row) is a Baby, the first stage.
  const stage = isBellieStage(settings.bellieStageSeen) ? settings.bellieStageSeen : 'baby';
  return <BellieStageContext.Provider value={stage}>{children}</BellieStageContext.Provider>;
}
