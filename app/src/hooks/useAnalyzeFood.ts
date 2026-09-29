import { useCallback, useEffect, useRef, useState } from 'react';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { type AnalysisResult, type AnalyzeInput, analyzeFood } from '@/services/relayClient';

export type AnalyzeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; error: AppError };

/** Runs one relay analysis at a time. A newer call, reset() or unmounting cancels the one in flight. */
export function useAnalyzeFood() {
  const [state, setState] = useState<AnalyzeState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const analyze = useCallback(
    async (input: AnalyzeInput) => {
      cancel();
      const mine = new AbortController();
      controller.current = mine;
      setState({ status: 'loading' });
      try {
        const result = await analyzeFood(input, mine.signal);
        if (!mine.signal.aborted) setState({ status: 'done', result });
      } catch (caught) {
        if (mine.signal.aborted) return;
        const error = caught instanceof AppError ? caught : new AppError('INTERNAL');
        // Operation and code only: never the input or the analysis.
        logger.error('analyzeFood', error);
        setState({ status: 'error', error });
      }
    },
    [cancel],
  );

  const reset = useCallback(() => {
    cancel();
    setState({ status: 'idle' });
  }, [cancel]);

  return { state, analyze, reset };
}
