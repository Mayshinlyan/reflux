CREATE TABLE `food_log_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`food_log_id` integer NOT NULL,
	`tag_key` text NOT NULL,
	FOREIGN KEY (`food_log_id`) REFERENCES `food_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_log_tags_log_tag_uq` ON `food_log_tags` (`food_log_id`,`tag_key`);--> statement-breakpoint
ALTER TABLE `food_logs` ADD `notes` text;