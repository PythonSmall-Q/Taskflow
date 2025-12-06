-- Add role column to team_members
ALTER TABLE team_members ADD COLUMN role TEXT DEFAULT 'staff';

-- Add settings JSON column to teams
ALTER TABLE teams ADD COLUMN settings TEXT DEFAULT '{}';

-- Extend api_keys with per-minute limit and scopes
ALTER TABLE api_keys ADD COLUMN limit_per_minute INTEGER DEFAULT NULL;
ALTER TABLE api_keys ADD COLUMN scopes TEXT DEFAULT '[]';

-- Add archived flag to projects if not exists
ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0;
