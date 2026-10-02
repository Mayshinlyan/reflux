ALTER TABLE `symptom_logs` ADD `food_log_id` integer REFERENCES food_logs(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `symptom_logs_food_log_idx` ON `symptom_logs` (`food_log_id`);