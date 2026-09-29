CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_type` text NOT NULL,
	`source` text NOT NULL,
	`input_text` text,
	`photo_uri` text,
	`meal_name` text NOT NULL,
	`overall_verdict` text NOT NULL,
	`analysis` text NOT NULL,
	`analysis_meta` text NOT NULL,
	`logged_at` text NOT NULL,
	`tz` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "food_logs_entry_type_check" CHECK("food_logs"."entry_type" in ('diary', 'check')),
	CONSTRAINT "food_logs_source_check" CHECK("food_logs"."source" in ('photo', 'text')),
	CONSTRAINT "food_logs_verdict_check" CHECK("food_logs"."overall_verdict" in ('ok', 'caution', 'trigger'))
);
--> statement-breakpoint
CREATE INDEX `food_logs_diary_logged_at_idx` ON `food_logs` (`logged_at`) WHERE "food_logs"."entry_type" = 'diary';--> statement-breakpoint
CREATE TABLE `medication_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medication_id` integer,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`dose_text` text,
	`taken_at` text NOT NULL,
	`tz` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "medication_logs_type_check" CHECK("medication_logs"."type" in ('ppi', 'h2_blocker', 'antacid', 'alginate', 'other'))
);
--> statement-breakpoint
CREATE INDEX `medication_logs_taken_at_idx` ON `medication_logs` (`taken_at`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`default_dose` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "medications_type_check" CHECK("medications"."type" in ('ppi', 'h2_blocker', 'antacid', 'alginate', 'other'))
);
--> statement-breakpoint
CREATE TABLE `symptom_log_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symptom_log_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`symptom_log_id`) REFERENCES `symptom_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "symptom_log_items_score_check" CHECK("symptom_log_items"."score" between 0 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `symptom_log_items_log_item_uq` ON `symptom_log_items` (`symptom_log_id`,`item_key`);--> statement-breakpoint
CREATE TABLE `symptom_log_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symptom_log_id` integer NOT NULL,
	`tag_key` text NOT NULL,
	FOREIGN KEY (`symptom_log_id`) REFERENCES `symptom_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `symptom_log_tags_log_tag_uq` ON `symptom_log_tags` (`symptom_log_id`,`tag_key`);--> statement-breakpoint
CREATE TABLE `symptom_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'quick' NOT NULL,
	`logged_at` text NOT NULL,
	`tz` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "symptom_logs_kind_check" CHECK("symptom_logs"."kind" in ('quick', 'checkin'))
);
--> statement-breakpoint
CREATE INDEX `symptom_logs_logged_at_idx` ON `symptom_logs` (`logged_at`);