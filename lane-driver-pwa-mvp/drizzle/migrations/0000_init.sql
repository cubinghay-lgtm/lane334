CREATE TABLE `hazard_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` text,
	`author_label` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`location` text,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`report_count` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hazard_posts_kind` ON `hazard_posts` (`kind`);--> statement-breakpoint
CREATE TABLE `hazard_reports` (
	`post_id` integer NOT NULL,
	`learner_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`post_id`, `learner_id`),
	FOREIGN KEY (`post_id`) REFERENCES `hazard_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hazard_votes` (
	`post_id` integer NOT NULL,
	`learner_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `learner_id`),
	FOREIGN KEY (`post_id`) REFERENCES `hazard_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `learners` (
	`id` text PRIMARY KEY NOT NULL,
	`analytics_opt_out` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`mode` text NOT NULL,
	`first_answer_correct` integer NOT NULL,
	`follow_up_correct` integer,
	`accuracy` real NOT NULL,
	`work` real NOT NULL,
	`attention` real NOT NULL,
	`time_quality` real NOT NULL,
	`session_mastery` real NOT NULL,
	`smoothed_mastery` real NOT NULL,
	`band` text NOT NULL,
	`active_seconds` real NOT NULL,
	`video_completion` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `learning_events_learner` ON `learning_events` (`learner_id`);--> statement-breakpoint
CREATE TABLE `topic_mastery` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`mastery` real DEFAULT 0 NOT NULL,
	`session_mastery` real DEFAULT 0 NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`review_attempts` integer DEFAULT 0 NOT NULL,
	`review_correct` integer DEFAULT 0 NOT NULL,
	`knowledge_check_passed` integer DEFAULT false NOT NULL,
	`last_first_answer_correct` integer,
	`video_completion` real DEFAULT 0 NOT NULL,
	`key_watched` integer DEFAULT false NOT NULL,
	`average_active_seconds` real DEFAULT 0 NOT NULL,
	`skip_count` integer DEFAULT 0 NOT NULL,
	`help_count` integer DEFAULT 0 NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`review_later` integer DEFAULT false NOT NULL,
	`review_priority` real DEFAULT 0 NOT NULL,
	`last_practiced_at` integer,
	`last_reviewed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_mastery_learner_topic` ON `topic_mastery` (`learner_id`,`topic_id`);