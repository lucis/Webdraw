PRAGMA foreign_keys = ON;

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  drawing_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('html', 'react')),
  active_version INTEGER NOT NULL DEFAULT 1 CHECK (active_version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX artifacts_by_user_drawing_updated
  ON artifacts(user_id, drawing_id, updated_at DESC);

CREATE TABLE artifact_versions (
  artifact_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  kind TEXT NOT NULL CHECK (kind IN ('html', 'react')),
  payload_json TEXT NOT NULL,
  prompt TEXT,
  model TEXT,
  source_snapshot_json TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, version),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE INDEX artifact_versions_by_artifact_created
  ON artifact_versions(artifact_id, version DESC);

CREATE TABLE generation_runs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  drawing_id TEXT,
  artifact_id TEXT,
  purpose TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  elapsed_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE SET NULL,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE INDEX generation_runs_by_user_status_created
  ON generation_runs(user_id, status, created_at DESC);

CREATE INDEX generation_runs_by_artifact_status
  ON generation_runs(artifact_id, status, created_at DESC);
