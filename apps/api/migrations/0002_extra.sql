-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  active INTEGER DEFAULT 1
);

-- Automation rules
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL, -- e.g., task.status_changed, task.due_soon
  action TEXT NOT NULL,  -- e.g., webhook.call, task.archive
  config TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  active INTEGER DEFAULT 1
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read INTEGER DEFAULT 0
);
