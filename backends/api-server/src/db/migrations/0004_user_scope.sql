ALTER TABLE `documents` ADD `user_id` text;
--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `user_id` text;
--> statement-breakpoint
ALTER TABLE `confusions` ADD `user_id` text;
