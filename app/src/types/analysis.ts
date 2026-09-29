/**
 * Shape of a meal analysis as returned by the relay (POST /v1/analyze-food) and stored
 * in food_logs.analysis. The relay validates it strictly with zod (Step 5); the app
 * mirrors the type here.
 */
export type Verdict = 'ok' | 'caution' | 'trigger';

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
  overall: { verdict: Verdict; confidence: 'low' | 'medium' | 'high'; reasoning: string };
};

/** Which model, prompt and ruleset produced an analysis — stored with every result. */
export type AnalysisMeta = { model: string; promptVersion: string; rulesetVersion: string };
