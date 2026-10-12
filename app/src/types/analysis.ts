/**
 * Shape of a meal analysis as returned by the relay (POST /v1/analyze-food) and stored
 * in food_logs.analysis. The relay validates it strictly with zod (Step 5); the app
 * mirrors the type here.
 */
export type Verdict = 'ok' | 'caution' | 'trigger';

/**
 * What the app shows and stores as a verdict: the AI's three, plus 'good' ("Good"), which only the user can
 * set, by hand on a saved food. The relay never returns it.
 */
export type AppVerdict = Verdict | 'good';

/** How much the user ate, sent with a check so the verdict can account for it. */
export type Portion = 'small' | 'regular' | 'large';

export type TriggerCategory =
  | 'acidic'
  | 'caffeine'
  | 'mint'
  | 'alcohol'
  | 'carbonation'
  | 'high_fat'
  | 'spicy'
  | 'chocolate'
  | 'raw_garlic_onion'
  | 'large_portion';

export type MealItem = {
  name: string;
  ingredients: { name: string; matchedCategories: TriggerCategory[] }[];
  verdict: Verdict;
  reasoning: string;
  matchedTriggers: { category: TriggerCategory; evidence: string }[];
};

export type MealAnalysis = {
  isFood: boolean;
  mealName: string;
  items: MealItem[];
  overall: {
    verdict: Verdict;
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
    /** The verdict the user chose over the AI's `verdict`. The AI's own stays here for "The AI said …". */
    userVerdict?: AppVerdict;
  };
};

/** Which model, prompt and ruleset produced an analysis — stored with every result. */
export type AnalysisMeta = { model: string; promptVersion: string; rulesetVersion: string };
