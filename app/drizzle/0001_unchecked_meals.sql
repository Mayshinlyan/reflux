PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_food_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_type` text NOT NULL,
	`source` text NOT NULL,
	`input_text` text,
	`photo_uri` text,
	`meal_name` text NOT NULL,
	`overall_verdict` text,
	`analysis` text,
	`analysis_meta` text,
	`logged_at` text NOT NULL,
	`tz` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "food_logs_entry_type_check" CHECK("__new_food_logs"."entry_type" in ('diary', 'check')),
	CONSTRAINT "food_logs_source_check" CHECK("__new_food_logs"."source" in ('photo', 'text')),
	CONSTRAINT "food_logs_verdict_check" CHECK("__new_food_logs"."overall_verdict" in ('ok', 'caution', 'trigger'))
);
--> statement-breakpoint
INSERT INTO `__new_food_logs`("id", "entry_type", "source", "input_text", "photo_uri", "meal_name", "overall_verdict", "analysis", "analysis_meta", "logged_at", "tz", "created_at", "updated_at") SELECT "id", "entry_type", "source", "input_text", "photo_uri", "meal_name", "overall_verdict", "analysis", "analysis_meta", "logged_at", "tz", "created_at", "updated_at" FROM `food_logs`;--> statement-breakpoint
DROP TABLE `food_logs`;--> statement-breakpoint
ALTER TABLE `__new_food_logs` RENAME TO `food_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `food_logs_diary_logged_at_idx` ON `food_logs` (`logged_at`) WHERE "food_logs"."entry_type" = 'diary';