ALTER TABLE `boards` ADD `next_card_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `number` integer;--> statement-breakpoint
UPDATE `cards` SET `number` = (
  SELECT COUNT(*)
  FROM `cards` c2
  JOIN `lists` l2 ON c2.`list_id` = l2.`id`
  WHERE l2.`board_id` = (SELECT l1.`board_id` FROM `lists` l1 WHERE l1.`id` = `cards`.`list_id`)
    AND (c2.`created_at` < `cards`.`created_at`
      OR (c2.`created_at` = `cards`.`created_at` AND c2.`id` <= `cards`.`id`))
);--> statement-breakpoint
UPDATE `boards` SET `next_card_number` = COALESCE((
  SELECT MAX(c.`number`)
  FROM `cards` c
  JOIN `lists` l ON c.`list_id` = l.`id`
  WHERE l.`board_id` = `boards`.`id`
), 0) + 1;