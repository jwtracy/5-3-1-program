CREATE TABLE `exercise_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`status` text DEFAULT 'done' NOT NULL,
	`unit` text DEFAULT 'lb' NOT NULL,
	`feel` text,
	`notes` text,
	`sets` integer,
	`reps` integer,
	`weight` real,
	`technique_grade` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`day_group` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_main` integer DEFAULT false NOT NULL,
	`lift_key` text,
	`tracking_mode` text DEFAULT 'reps' NOT NULL,
	`weight_options` text,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `program_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`cycle` integer DEFAULT 1 NOT NULL,
	`week` integer DEFAULT 1 NOT NULL,
	`next_slot` text DEFAULT 'a' NOT NULL,
	`paused_until` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`day_group` text NOT NULL,
	`cycle` integer,
	`week` integer,
	`rounds` integer,
	`duration_min` integer,
	`distance` real,
	`distance_unit` text,
	`overall_feel` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `set_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise_log_id` integer NOT NULL,
	`set_number` integer NOT NULL,
	`weight` real,
	`reps` integer,
	`hold_seconds` integer,
	`rir` integer,
	`technique_grade` integer,
	`is_amrap` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`exercise_log_id`) REFERENCES `exercise_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `training_maxes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`lift_key` text NOT NULL,
	`training_max` real,
	`unit` text DEFAULT 'lb' NOT NULL,
	`increment_lb` real DEFAULT 5 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_maxes_lift_key_unique` ON `training_maxes` (`lift_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`program_type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_slug_unique` ON `users` (`slug`);