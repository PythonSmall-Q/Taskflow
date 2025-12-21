-- Task templates for reusable task patterns
CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config TEXT NOT NULL, -- JSON: {title, description, labels, priority, estimate_minutes}
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_templates_team ON task_templates(team_id);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- created, updated, deleted, commented, etc.
  entity_type TEXT NOT NULL, -- task, project, comment, etc.
  entity_id TEXT NOT NULL,
  changes TEXT, -- JSON with before/after values
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_team ON activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);

-- Recurring tasks
CREATE TABLE IF NOT EXISTS recurring_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  labels TEXT,
  priority TEXT NOT NULL,
  estimate_minutes INTEGER,
  recurrence_rule TEXT NOT NULL, -- JSON: {frequency: 'daily'|'weekly'|'monthly', interval: 1, daysOfWeek: [0-6]}
  template_config TEXT NOT NULL, -- JSON task template
  next_run_at INTEGER NOT NULL,
  last_run_at INTEGER,
  enabled INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_project ON recurring_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_run ON recurring_tasks(next_run_at, enabled);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  email_notifications INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  updated_at INTEGER NOT NULL
);

-- Task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL CHECK(dependency_type IN ('blocks','blocked_by')),
  created_at INTEGER NOT NULL,
  UNIQUE(task_id, depends_on_task_id)
);
CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON task_dependencies(depends_on_task_id);

-- Add assignee to tasks (if not exists)
-- ALTER TABLE tasks ADD COLUMN assignee_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
