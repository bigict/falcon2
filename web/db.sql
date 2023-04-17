CREATE TABLE if not EXISTS `jobs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `job_id` varchar(20) NOT NULL UNIQUE KEY,
  `app` varchar(64) NOT NULL COMMENT 'profold, abfold etc',
  `email` varchar(128) NOT NULL,
  `inputs` text DEFAULT NULL,
  `status` varchar(10) NOT NULL,
  `time_create` datetime DEFAULT CURRENT_TIMESTAMP,
  `time_run` datetime DEFAULT NULL,
  `time_done` datetime DEFAULT NULL,
  `ip` varchar(20) NOT NULL,
  INDEX `idx_app` (`app`),
  INDEX `idx_email` (`email`),
  INDEX `idx_status` (`status`)
);

CREATE TABLE if not EXISTS `tasks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `description` varchar(1024) NOT NULL,
  `content` text DEFAULT NULL,
  `status` varchar(10) NOT NULL,
  `metrics` varchar(1024) DEFAULT NULL,
  `time_create` datetime DEFAULT CURRENT_TIMESTAMP,
  `time_run` datetime DEFAULT NULL,
  `time_done` datetime DEFAULT NULL,
  `job_id` varchar(20) NOT NULL,
  `task_id` int unsigned NOT NULL,
  INDEX `idx_job_id` (`job_id`),
  UNIQUE KEY `idx_task_id` (`job_id`, `task_id`)
);
