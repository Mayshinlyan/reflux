import type { AppVerdict, MealAnalysis } from '@/types/analysis';

/** The verdict to show and store: the one the user set, or else the AI's. */
export function effectiveVerdict(analysis: MealAnalysis): AppVerdict {
  return analysis.overall.userVerdict ?? analysis.overall.verdict;
}

/**
 * The analysis with the user's verdict on top of the AI's. Choosing the AI's own verdict removes the
 * override. The AI's verdict and reasoning are never touched.
 */
export function withUserVerdict(analysis: MealAnalysis, verdict: AppVerdict): MealAnalysis {
  const { userVerdict: _previous, ...overall } = analysis.overall;
  return {
    ...analysis,
    overall: verdict === overall.verdict ? overall : { ...overall, userVerdict: verdict },
  };
}
