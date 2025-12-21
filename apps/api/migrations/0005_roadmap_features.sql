-- Time tracking tables
CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration_seconds INTEGER,
  description TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(user_id, end_time);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  action_url TEXT,
  read INTEGER DEFAULT 0,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read);

-- Email queue for async email sending
CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','sent','failed')),
  error TEXT,
  sent_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);

-- Custom field definitions
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK(field_type IN ('text','number','date','select','multi-select','checkbox','url','email')),
  required INTEGER DEFAULT 0,
  options TEXT, -- JSON array for select/multi-select
  validation TEXT, -- JSON validation rules
  display_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_project ON custom_field_definitions(project_id);

-- Custom field values
CREATE TABLE IF NOT EXISTS custom_field_values (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  value TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(task_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_task ON custom_field_values(task_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values(field_id);
