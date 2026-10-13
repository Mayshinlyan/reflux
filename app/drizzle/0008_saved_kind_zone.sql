ALTER TABLE `saved_symptoms` ADD `kind` text DEFAULT 'symptom' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_symptoms` ADD `zone` text;