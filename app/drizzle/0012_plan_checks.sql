CREATE TABLE `plan_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `meal_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "plan_checks_kind_check" CHECK("plan_checks"."kind" in ('prep', 'shop', 'own'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_checks_uq` ON `plan_checks` (`plan_id`,`kind`,`key`);