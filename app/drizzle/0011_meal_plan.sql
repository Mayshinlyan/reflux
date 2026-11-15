CREATE TABLE `meal_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`mode` text NOT NULL,
	`choices` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "meal_plans_mode_check" CHECK("meal_plans"."mode" in ('once', 'daily'))
);
--> statement-breakpoint
CREATE INDEX `meal_plans_created_idx` ON `meal_plans` (`created_at`);--> statement-breakpoint
CREATE TABLE `planned_meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`day` text NOT NULL,
	`slot` text NOT NULL,
	`dish_id` text NOT NULL,
	`recipe` text NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `meal_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "planned_meals_slot_check" CHECK("planned_meals"."slot" in ('breakfast', 'lunch', 'dinner'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planned_meals_slot_uq` ON `planned_meals` (`plan_id`,`day`,`slot`);--> statement-breakpoint
CREATE INDEX `planned_meals_day_idx` ON `planned_meals` (`day`);