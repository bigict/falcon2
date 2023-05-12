CREATE TABLE if not EXISTS `jobs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `job_id` varchar(20) NOT NULL UNIQUE KEY,
  `sequences` text DEFAULT NULL,
  `status` varchar(10) NOT NULL,
  `time_create` datetime DEFAULT CURRENT_TIMESTAMP,
  `time_run` datetime DEFAULT NULL,
  `time_done` datetime DEFAULT NULL,
  UNIQUE INDEX `idx_job_id` (`job_id`),
  INDEX `idx_status` (`status`)
);

CREATE TABLE if not EXISTS `tasks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `descripton` varchar(1024) NOT NULL,
  `sequence` varchar(4096) NOT NULL,
  `status` varchar(10) NOT NULL,
  `metrics` varchar(1024) DEFAULT NULL,
  `time_create` datetime DEFAULT CURRENT_TIMESTAMP,
  `time_run` datetime DEFAULT NULL,
  `time_done` datetime DEFAULT NULL,
  `job_id` varchar(20) NOT NULL,
  INDEX `idx_job_id` (`job_id`)
);