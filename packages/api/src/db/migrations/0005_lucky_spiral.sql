ALTER TABLE `cards` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `lists` ADD `is_done` integer DEFAULT false NOT NULL;