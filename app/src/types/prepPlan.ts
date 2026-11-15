/** A step that serves several dishes: `feeds` holds the ids the app sent (see `prepAliases`). */
export type PrepStepRef = { text: string; feeds: string[] };

/** What the relay returns for a prep session (POST /v1/prep-plan): the shared steps, each dish's own, the finish. */
export type PrepPlanResult = {
  start: PrepStepRef[];
  dishes: { dish: string; steps: string[] }[];
  finish: PrepStepRef[];
};

/**
 * What is sent to plan a prep session: the dishes of the plan with their recipes. Food and cooking text only: never
 * symptoms, notes or the person's name. Mirrors the relay's `prepPlanBodySchema`.
 */
export type PrepPlanRequest = {
  dishes: {
    id: string;
    title: string;
    minutes: number;
    keepsDays: number;
    meals: number;
    ingredients: string[];
    steps: string[];
  }[];
  prepMinutes?: number;
};
