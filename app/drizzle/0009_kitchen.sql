CREATE TABLE `avoid_foods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avoid_foods_name_uq` ON `avoid_foods` (lower("name"));--> statement-breakpoint
CREATE TABLE `saved_recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`cuisine` text NOT NULL,
	`minutes` integer NOT NULL,
	`serves` integer NOT NULL,
	`recipe` text NOT NULL,
	`rating` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "saved_recipes_rating_check" CHECK("saved_recipes"."rating" in ('up', 'down'))
);
--> statement-breakpoint
CREATE INDEX `saved_recipes_created_idx` ON `saved_recipes` (`created_at`);