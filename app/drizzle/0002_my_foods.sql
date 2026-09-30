CREATE TABLE `saved_foods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`input_text` text,
	`photo_uri` text,
	`meal_name` text NOT NULL,
	`overall_verdict` text,
	`analysis` text,
	`analysis_meta` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "saved_foods_source_check" CHECK("saved_foods"."source" in ('photo', 'text')),
	CONSTRAINT "saved_foods_verdict_check" CHECK("saved_foods"."overall_verdict" in ('ok', 'caution', 'trigger'))
);
