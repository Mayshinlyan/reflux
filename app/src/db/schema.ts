import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * On-device schema. All health data lives only here, on the phone.
 *
 * Conventions:
 * - Times are ISO-8601 UTC strings (`logged_at`), with the IANA zone they were logged in
 *   (`tz`) so "which local day" can be recomputed correctly after travel or DST.
 * - Enum-like columns store stable keys (see src/constants), guarded by CHECK constraints.
 * - Migrations are additive only: never drop or rename a column that holds user data.
 */

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
};

export const symptomLogs = sqliteTable(
  'symptom_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** `quick` = tap-chips log; `checkin` = full RSI check-in (Milestone 2). */
    kind: text('kind', { enum: ['quick', 'checkin'] })
      .notNull()
      .default('quick'),
    loggedAt: text('logged_at').notNull(),
    tz: text('tz').notNull(),
    notes: text('notes'),
    /** The meal this was logged right after (from the "Any symptoms?" prompt); cleared if that meal is deleted. */
    foodLogId: integer('food_log_id').references(() => foodLogs.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('symptom_logs_logged_at_idx').on(t.loggedAt),
    index('symptom_logs_food_log_idx').on(t.foodLogId),
    check('symptom_logs_kind_check', sql`${t.kind} in ('quick', 'checkin')`),
  ],
);

export const symptomLogItems = sqliteTable(
  'symptom_log_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    symptomLogId: integer('symptom_log_id')
      .notNull()
      .references(() => symptomLogs.id, { onDelete: 'cascade' }),
    itemKey: text('item_key').notNull(),
    score: integer('score').notNull(),
  },
  (t) => [
    uniqueIndex('symptom_log_items_log_item_uq').on(t.symptomLogId, t.itemKey),
    check('symptom_log_items_score_check', sql`${t.score} between 0 and 5`),
  ],
);

export const symptomLogTags = sqliteTable(
  'symptom_log_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    symptomLogId: integer('symptom_log_id')
      .notNull()
      .references(() => symptomLogs.id, { onDelete: 'cascade' }),
    tagKey: text('tag_key').notNull(),
  },
  (t) => [uniqueIndex('symptom_log_tags_log_tag_uq').on(t.symptomLogId, t.tagKey)],
);

/** One row per meal. `diary` = eaten and logged; `check` = a one-off "should I eat this?". */
export const foodLogs = sqliteTable(
  'food_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entryType: text('entry_type', { enum: ['diary', 'check'] }).notNull(),
    source: text('source', { enum: ['photo', 'text'] }).notNull(),
    inputText: text('input_text'),
    /** Local file URI of the (EXIF-stripped) photo in app storage. */
    photoUri: text('photo_uri'),
    mealName: text('meal_name').notNull(),
    /** Null for a meal saved without a check (e.g. offline): it has no verdict, analysis or meta. */
    overallVerdict: text('overall_verdict', { enum: ['good', 'ok', 'caution', 'trigger'] }),
    /** JSON: items, ingredients, verdicts, reasoning, matched triggers, overall. */
    analysis: text('analysis', { mode: 'json' }),
    /** JSON: { model, promptVersion, rulesetVersion } — which AI produced this result. */
    analysisMeta: text('analysis_meta', { mode: 'json' }),
    /** How much was eaten, chosen on the details step. Null is a regular portion. */
    portion: text('portion', { enum: ['small', 'regular', 'large'] }),
    /** A free-text note from the details step ("How did it feel?"). */
    notes: text('notes'),
    loggedAt: text('logged_at').notNull(),
    tz: text('tz').notNull(),
    ...timestamps,
  },
  (t) => [
    index('food_logs_diary_logged_at_idx')
      .on(t.loggedAt)
      .where(sql`${t.entryType} = 'diary'`),
    check('food_logs_entry_type_check', sql`${t.entryType} in ('diary', 'check')`),
    check('food_logs_source_check', sql`${t.source} in ('photo', 'text')`),
    check('food_logs_verdict_check', sql`${t.overallVerdict} in ('good', 'ok', 'caution', 'trigger')`),
  ],
);

/** Lifestyle factors tagged on a meal (stress, large meal...). Same keys as `symptom_log_tags`. */
export const foodLogTags = sqliteTable(
  'food_log_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    foodLogId: integer('food_log_id')
      .notNull()
      .references(() => foodLogs.id, { onDelete: 'cascade' }),
    tagKey: text('tag_key').notNull(),
  },
  (t) => [uniqueIndex('food_log_tags_log_tag_uq').on(t.foodLogId, t.tagKey)],
);

const MEDICATION_TYPE_SQL = sql`('ppi', 'h2_blocker', 'antacid', 'alginate', 'other')`;

export const medications = sqliteTable(
  'medications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['ppi', 'h2_blocker', 'antacid', 'alginate', 'other'] }).notNull(),
    defaultDose: text('default_dose'),
    /** Archived meds are hidden from "my meds" but keep their history. */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => [check('medications_type_check', sql`${t.type} in ${MEDICATION_TYPE_SQL}`)],
);

export const medicationLogs = sqliteTable(
  'medication_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Nullable so history survives deleting a saved medication. */
    medicationId: integer('medication_id').references(() => medications.id, { onDelete: 'set null' }),
    /** Snapshots, so renaming a saved med doesn't rewrite history. */
    name: text('name').notNull(),
    type: text('type', { enum: ['ppi', 'h2_blocker', 'antacid', 'alginate', 'other'] }).notNull(),
    doseText: text('dose_text'),
    takenAt: text('taken_at').notNull(),
    tz: text('tz').notNull(),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('medication_logs_taken_at_idx').on(t.takenAt),
    check('medication_logs_type_check', sql`${t.type} in ${MEDICATION_TYPE_SQL}`),
  ],
);

/**
 * "Favorite foods": meals the user eats often, saved for one-tap logging. Each row is a snapshot of a meal
 * (like a food log, minus the time), so logging it reuses the stored verdict and never calls the relay.
 * Logged meals are copies, so removing a saved food never touches History.
 */
export const savedFoods = sqliteTable(
  'saved_foods',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source', { enum: ['photo', 'text'] }).notNull(),
    inputText: text('input_text'),
    /** Local file URI of the photo in app storage; shared with the food log it was saved from. */
    photoUri: text('photo_uri'),
    mealName: text('meal_name').notNull(),
    /** Null for a food added by name only: it has no verdict or analysis. */
    overallVerdict: text('overall_verdict', { enum: ['good', 'ok', 'caution', 'trigger'] }),
    analysis: text('analysis', { mode: 'json' }),
    analysisMeta: text('analysis_meta', { mode: 'json' }),
    ...timestamps,
  },
  (t) => [
    check('saved_foods_source_check', sql`${t.source} in ('photo', 'text')`),
    check('saved_foods_verdict_check', sql`${t.overallVerdict} in ('good', 'ok', 'caution', 'trigger')`),
  ],
);

/**
 * "My additions": symptoms and lifestyle factors the user typed with a "+" chip, kept as quick-pick
 * chips. Removing one only takes the chip away; entries already logged keep their `custom:<name>` item.
 */
export const savedSymptoms = sqliteTable(
  'saved_symptoms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    /** 'symptom' or 'lifestyle': what the typed text is. */
    kind: text('kind', { enum: ['symptom', 'lifestyle'] })
      .notNull()
      .default('symptom'),
    /** The body area a symptom was added in (a bodyZones key); null for lifestyle, or a symptom saved before areas. */
    zone: text('zone'),
    ...timestamps,
  },
  (t) => [uniqueIndex('saved_symptoms_name_uq').on(sql`lower(${t.name})`)],
);

/** Key/value settings. Values are JSON-encoded; see repositories/settings.ts for keys and defaults. */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamps.updatedAt,
});

export type SymptomLog = typeof symptomLogs.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type SavedFood = typeof savedFoods.$inferSelect;
export type SavedSymptom = typeof savedSymptoms.$inferSelect;
export type MedicationLog = typeof medicationLogs.$inferSelect;
