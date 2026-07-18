CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`card_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_card_idx` ON `comments` (`card_id`);