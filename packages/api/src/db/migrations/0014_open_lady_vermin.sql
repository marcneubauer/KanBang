ALTER TABLE `boards` ADD `covers_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `cover_type` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `cover_value` text;