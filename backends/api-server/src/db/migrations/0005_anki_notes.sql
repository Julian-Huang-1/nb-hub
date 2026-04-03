CREATE TABLE `anki_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`deck_name` text DEFAULT 'Default' NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`ease` integer DEFAULT 2500 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`due_at` integer,
	`created_at` integer NOT NULL
);
