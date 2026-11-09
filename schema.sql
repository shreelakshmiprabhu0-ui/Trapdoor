-- TRAPDOOR schema (owned by Student B)
-- Docker Compose runs this automatically against $DB_NAME on first start.
-- For a manual run:  CREATE DATABASE trapdoor CHARACTER SET utf8mb4;  USE trapdoor;  then source this file.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('USER','DEFENDER') NOT NULL DEFAULT 'USER',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The single "main application data" type for the portal.
CREATE TABLE IF NOT EXISTS notes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  title      VARCHAR(100) NOT NULL,
  content    VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notes_user (user_id),
  CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trap-route events. details must be small and already sanitised (see db.js).
CREATE TABLE IF NOT EXISTS security_events (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type  VARCHAR(64)  NOT NULL,
  route       VARCHAR(255) NOT NULL,
  method      VARCHAR(10)  NOT NULL,
  session_ref VARCHAR(64)  NULL,          -- HMAC of the session id, never the cookie itself
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details     JSON NULL,
  PRIMARY KEY (id),
  KEY idx_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Server-side session store (used by express-mysql-session).
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB;
