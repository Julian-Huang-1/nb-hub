CREATE TABLE `chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tokens` integer,
	`metadata_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `confusions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`source_message_id` integer,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE TABLE `confusion_resolutions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`confusion_id` integer NOT NULL,
	`resolved_by_message_id` integer,
	`resolution_md` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `solution_docs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_key` text NOT NULL,
	`title` text NOT NULL,
	`content_md` text NOT NULL,
	`stats_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
