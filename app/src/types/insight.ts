/** Bellie's day or week summary, as the relay returns it (POST /v1/insight) and as it is cached. */
export type InsightTone = 'cheer' | 'nudge' | 'neutral';

export type Insight = {
  tone: InsightTone;
  /** One short line in Bellie's voice for the top of Today (at most about 40 characters). */
  bellieLine: string;
  /** One or two plain sentences about what stood out. */
  summary: string;
  /** Zero to three practical ideas about food, portion and timing. */
  tips: string[];
};

export type InsightRange = 'day' | 'week';

/**
 * What is sent to be summarised: only meal names with their verdicts, symptom names, and lifestyle tags, each
 * with a short "when". Never notes, photos or the person's name. Mirrors the relay's `insightBodySchema`.
 */
export type InsightRequest = {
  range: InsightRange;
  meals: { name: string; verdict: 'ok' | 'caution' | 'trigger' | 'good'; when: string }[];
  symptoms: { name: string; when: string }[];
  tags: string[];
};
