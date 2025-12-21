# API Functions Reference

## New Functions Added

### Task Operations

#### Bulk Operations
**Endpoint:** `POST /tasks/bulk`
**Description:** Perform bulk operations on multiple tasks simultaneously
**Body:**
```json
{
  "operation": "delete" | "move" | "update",
  "taskIds": ["task-id-1", "task-id-2"],
  "status": "done",  // for move operation
  "updates": {       // for update operation
    "priority": "high",
    "due_date": 1640000000000
  }
}
```
**Response:** `{ ok: true, deleted: 2 }` or `{ ok: true, updated: 2 }`

#### Duplicate Task
**Endpoint:** `POST /tasks/:id/duplicate`
**Description:** Create a copy of an existing task with reset status
**Response:** `{ task: { id: "new-id", key: "TASK-0123" } }`

#### Create from Template
**Endpoint:** `POST /tasks/from-template/:templateId`
**Description:** Create a new task from a saved template
**Body:** `{ "projectId": "project-id" }`
**Response:** `{ task: { id: "new-id", key: "TASK-0124" } }`

#### Export Tasks
**Endpoint:** `GET /tasks/:projectId/export?format=json|csv`
**Description:** Export all tasks from a project as JSON or CSV
**Response:** JSON array or CSV file download

#### Advanced Search
**Endpoint:** `POST /tasks/search`
**Description:** Search tasks with advanced filtering
**Body:**
```json
{
  "query": "search text",
  "projectId": "project-id",
  "status": "todo",
  "priority": "high",
  "assigneeId": "user-id",
  "dueBefore": 1640000000000,
  "dueAfter": 1630000000000
}
```
**Response:** `{ tasks: [...], count: 10 }`

### Task Templates

#### List Templates
**Endpoint:** `GET /templates?teamId=team-id`
**Description:** Get all task templates for a team
**Response:** `{ templates: [...] }`

#### Create Template
**Endpoint:** `POST /templates`
**Description:** Create a reusable task template
**Body:**
```json
{
  "teamId": "team-id",
  "name": "Bug Report Template",
  "description": "Standard bug report",
  "config": {
    "title": "Bug: ",
    "description": "## Steps to Reproduce\n\n## Expected\n\n## Actual",
    "labels": ["bug"],
    "priority": "high"
  }
}
```

#### Update Template
**Endpoint:** `PATCH /templates/:id`
**Description:** Update a template
**Body:** `{ "name": "New Name", "config": {...} }`

#### Delete Template
**Endpoint:** `DELETE /templates/:id`
**Description:** Remove a template

### Recurring Tasks

#### List Recurring Tasks
**Endpoint:** `GET /recurring?projectId=project-id`
**Description:** Get all recurring task configurations
**Response:** `{ recurringTasks: [...] }`

#### Create Recurring Task
**Endpoint:** `POST /recurring`
**Description:** Set up a recurring task schedule
**Body:**
```json
{
  "projectId": "project-id",
  "title": "Weekly Report",
  "recurrenceRule": {
    "frequency": "weekly",
    "interval": 1,
    "daysOfWeek": [1]  // Monday
  },
  "priority": "medium"
}
```

#### Update Recurring Task
**Endpoint:** `PATCH /recurring/:id`
**Description:** Modify recurring task settings
**Body:** `{ "enabled": false }` or update recurrence rule

#### Delete Recurring Task
**Endpoint:** `DELETE /recurring/:id`
**Description:** Remove recurring task schedule

#### Process Recurring Tasks
**Endpoint:** `POST /recurring/process`
**Description:** Trigger processing of due recurring tasks (scheduled/cron)
**Response:** `{ processed: 5, timestamp: 1640000000000 }`

### Activity Log

#### Get Activity Feed
**Endpoint:** `GET /activity?teamId=team-id&limit=50&offset=0`
**Description:** Get activity log with optional filters
**Query Params:**
- `teamId`: Filter by team
- `entityType`: Filter by entity (task, project, comment)
- `entityId`: Filter by specific entity
- `limit`: Results per page (default 50)
- `offset`: Pagination offset

**Response:**
```json
{
  "activities": [
    {
      "id": "activity-id",
      "user_id": "user-id",
      "user_name": "John Doe",
      "user_avatar": "url",
      "action": "created",
      "entity_type": "task",
      "entity_id": "task-id",
      "changes": { "before": {...}, "after": {...} },
      "created_at": 1640000000000
    }
  ]
}
```

### User Management

#### Get Profile
**Endpoint:** `GET /users/me`
**Description:** Get current user's profile and settings
**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar_url": "url",
    "preferences": {},
    "email_notifications": 1,
    "theme": "light",
    "language": "en",
    "timezone": "UTC"
  }
}
```

#### Update Profile
**Endpoint:** `PATCH /users/me`
**Description:** Update user profile information
**Body:** `{ "name": "New Name", "avatarUrl": "url", "preferences": {...} }`

#### Get Settings
**Endpoint:** `GET /users/me/settings`
**Description:** Get user settings (notifications, theme, etc.)

#### Update Settings
**Endpoint:** `PATCH /users/me/settings`
**Description:** Update user settings
**Body:**
```json
{
  "emailNotifications": true,
  "theme": "dark",
  "language": "en",
  "timezone": "America/New_York"
}
```

#### Get User Statistics
**Endpoint:** `GET /users/me/stats`
**Description:** Get user activity statistics
**Response:**
```json
{
  "stats": {
    "tasksByStatus": [
      { "status": "todo", "count": 10 },
      { "status": "done", "count": 25 }
    ],
    "assignedTasks": 5,
    "projects": 3,
    "comments": 42
  }
}
```

### Project Features

#### Get Project Statistics
**Endpoint:** `GET /projects/:id/stats`
**Description:** Get comprehensive project analytics
**Response:**
```json
{
  "stats": {
    "tasksByStatus": [...],
    "tasksByPriority": [...],
    "overdueTasks": 3,
    "estimates": {
      "completed": 480,
      "total": 960,
      "percentage": 50
    },
    "recentActivity": [
      { "day": "2024-01-15", "created": 5, "completed": 3 }
    ],
    "contributors": [
      {
        "id": "user-id",
        "name": "John Doe",
        "avatar_url": "url",
        "tasks_assigned": 10,
        "comments_made": 25
      }
    ]
  }
}
```

#### Duplicate Project
**Endpoint:** `POST /projects/:id/duplicate`
**Description:** Create a copy of a project structure
**Response:** `{ project: { id: "new-id", name: "Project Name (Copy)" } }`

#### Archive/Unarchive Project
**Endpoint:** `PATCH /projects/:id/archive`
**Description:** Archive or restore a project
**Body:** `{ "archived": true }`

## Recurrence Rule Format

For recurring tasks, use the following rule structure:

```json
{
  "frequency": "daily" | "weekly" | "monthly" | "yearly",
  "interval": 1,  // Every N periods
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6]  // Optional: 0=Sunday, 6=Saturday
}
```

**Examples:**
- Daily: `{ "frequency": "daily", "interval": 1 }`
- Every 3 days: `{ "frequency": "daily", "interval": 3 }`
- Weekly on Monday: `{ "frequency": "weekly", "interval": 1, "daysOfWeek": [1] }`
- Biweekly: `{ "frequency": "weekly", "interval": 2 }`
- Monthly: `{ "frequency": "monthly", "interval": 1 }`

## Activity Actions

The activity log tracks these actions:
- `created` - Entity was created
- `updated` - Entity was modified
- `deleted` - Entity was removed
- `commented` - Comment was added
- `assigned` - Task was assigned
- `status_changed` - Task status changed
- `archived` - Project was archived
- `restored` - Project was restored

## Setup Required

Run the new migration to add tables:
```bash
wrangler d1 execute DB --file=apps/api/migrations/0004_features.sql
```

For production:
```bash
wrangler d1 execute DB --file=apps/api/migrations/0004_features.sql --remote
```
