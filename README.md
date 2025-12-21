# Taskflow Zero

🚀 **Modern, real-time, intelligent task management platform built on Cloudflare Workers**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

## ✨ Features

### Core Features

- 📊 **Kanban Board**: Drag-and-drop task management across todo, in-progress, review, and done columns
- 🎯 **Smart Filtering**: Search and filter tasks by status, priority, labels, and more
- 🏷️ **Task Management**: Full CRUD operations with priority levels, due dates, and custom labels
- 💬 **Comments & Collaboration**: Markdown-supported comments with file attachments and @mentions
- 📝 **Markdown Editor**: Rich text editing with live preview for task descriptions
- 🔔 **Real-time Updates**: WebSocket-powered live collaboration via Durable Objects

### Advanced Features

- 🔐 **Authentication**: Secure JWT-based auth with optional OAuth (Google/GitHub)
- 🔑 **API Keys**: Generate and manage API keys with scoped permissions and rate limiting
- 👥 **Team Management**: Multi-user teams with role-based access control
- 🤖 **Automations**: Trigger webhooks and notifications on task events
- 📈 **Reports**: Burnup charts and workload analytics
- 🔗 **Integrations**: Slack/Discord webhooks, Google Calendar sync
- 🎨 **Themes**: Light and dark mode support
- 🌐 **i18n**: Multi-language support (English, Chinese)
- 📱 **PWA**: Progressive Web App with offline support

### Technical Features

- ⚡ **Edge Computing**: Deployed on Cloudflare's global network for <50ms response times
- 🗄️ **Serverless Database**: D1 (SQLite) for reliable, scalable data storage
- 📦 **File Storage**: R2 for unlimited file attachments
- 🧠 **AI Ready**: Workers AI integration for task auto-tagging and smart assignment
- 🔒 **Security**: Rate limiting, API key scopes, CORS support

## Tech Stack

- Cloudflare Workers + Hono (API)
- Cloudflare D1 (DB), R2 (files), KV (cache), Durable Objects (realtime), Workers AI
- React + Vite (PWA)

## 🚀 Quick Start

### Local Development

**Prerequisites**: Node.js 18+, npm, Cloudflare Wrangler CLI

1. **Clone and install**

```bash
git clone https://github.com/PythonSmall-Q/Taskflow.git
cd Taskflow
npm install
```

2. **Set up local database**

```bash
# Create D1 database
wrangler d1 create taskflow-db --config wrangler.toml

# Run migrations
wrangler d1 migrations apply taskflow-db --local --config wrangler.toml
```

3. **Build frontend and start dev server**

```bash
npm --workspace @taskflow/web run build
npm run dev
```

4. **Open your browser**

Navigate to http://127.0.0.1:8787

### First Steps

1. Create an account (no email verification needed for local dev)
2. Create your first project
3. Add tasks and start organizing!
4. Try drag-and-drop to move tasks between columns
5. Click "💬 Comment" to add comments with Markdown
6. Click "✏️ Edit" to update task details

## 📚 Documentation

- **[Deployment Guide](DEPLOYMENT.md)**: Complete production deployment instructions
- **[Contributing Guide](CONTRIBUTING.md)**: How to contribute to the project
- **[API Documentation](http://localhost:8787/docs)**: OpenAPI/Swagger docs (when running locally)

## 🛠️ Tech Stack

### Frontend

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Beautiful DnD** - Drag and drop functionality
- **React Markdown** - Markdown rendering
- **Vite PWA** - Progressive Web App support

### Backend

- **Cloudflare Workers** - Edge compute platform
- **Hono** - Fast web framework
- **Zod** - Schema validation
- **Jose** - JWT handling
- **YAML** - OpenAPI specification

### Data & Storage

- **D1 (SQLite)** - Serverless SQL database
- **R2** - Object storage for files
- **KV** - Key-value storage for cache
- **Durable Objects** - WebSocket and real-time state

### AI & Integrations

- **Workers AI** - Task auto-tagging and smart features
- **OAuth** - Google and GitHub authentication
- **Webhooks** - Slack, Discord, custom integrations

## Environment

`wrangler.toml` defines bindings. For production, add a `production` environment and set real IDs:

```toml
[env.production]
route = "your-domain.tld/*"
[[env.production.d1_databases]]
# ... production DB binding
```

Set a strong JWT secret:

```bash
wrangler secret put JWT_SECRET
```

## 📖 API Overview

### Authentication

```bash
# Register
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe"
}

# Login
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}

# Returns JWT token
{
  "token": "eyJhbGc..."
}
```

### Projects

```bash
# List projects
GET /projects
Authorization: Bearer {token}

# Create project
POST /projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "My Project",
  "description": "Project description",
  "color": "#7c3aed"
}
```

### Tasks

```bash
# List tasks for project
GET /tasks/{projectId}
Authorization: Bearer {token}

# Create task
POST /tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "projectId": "uuid",
  "title": "Task title",
  "description": "Task description",
  "priority": "high",
  "dueDate": 1734825600000,
  "labels": ["feature", "urgent"]
}

# Update task
PATCH /tasks/{taskId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Updated description",
  "priority": "medium"
}

# Move task
POST /tasks/move
Authorization: Bearer {token}
Content-Type: application/json

{
  "id": "task-uuid",
  "status": "done",
  "rank": 1734825600000
}

# Delete task
DELETE /tasks/{taskId}
Authorization: Bearer {token}
```

### Comments

```bash
# Get task comments
GET /comments/task/{taskId}
Authorization: Bearer {token}

# Add comment
POST /comments
Authorization: Bearer {token}
Content-Type: multipart/form-data

taskId=task-uuid
body=Comment text with **Markdown**
files=file1.png
files=file2.pdf
```

### API Keys

```bash
# List API keys
GET /api-keys
Authorization: Bearer {token}

# Create API key
POST /api-keys
Authorization: Bearer {token}
Content-Type: application/json

{
  "label": "CI/CD Integration"
}

# Configure API key
POST /api-keys/config/{keyId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "limit_per_minute": 100,
  "scopes": ["tasks:write", "projects:read"]
}

# Revoke API key
POST /api-keys/revoke/{keyId}
Authorization: Bearer {token}
```

### Using API Keys

```bash
# Use API key instead of JWT
GET /tasks/{projectId}
x-api-key: your-api-key-here
```

### WebSocket Real-time

```javascript
// Connect to project room
const ws = new WebSocket('wss://your-domain.com/realtime/room/{projectId}')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Handle real-time updates
  // data.type: 'comment.created', 'task.updated', etc.
}
```

### OpenAPI Documentation

- **Swagger UI**: http://localhost:8787/docs
- **OpenAPI JSON**: http://localhost:8787/openapi.json
- **OpenAPI YAML**: http://localhost:8787/openapi.yaml

## 🎯 Use Cases

- **Software Development**: Manage sprints, track bugs, organize feature development
- **Product Management**: Prioritize backlogs, track roadmaps, coordinate releases
- **Content Creation**: Plan content calendars, track article/video production
- **Event Planning**: Organize tasks, assign responsibilities, track deadlines
- **Personal Projects**: Manage side projects, track learning goals
- **Client Work**: Track client requests, manage deliverables

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **API Key Scopes**: Fine-grained permissions (e.g., `tasks:write`, `projects:read`)
- **Rate Limiting**: Global and per-key rate limits (default: 300 req/min)
- **CORS Protection**: Configurable cross-origin policies
- **Input Validation**: Zod schema validation on all inputs
- **Parameterized Queries**: Protection against SQL injection
- **Webhook Signatures**: HMAC-SHA256 signatures for webhook security

## 🌟 Advanced Features

### Automations

Create custom automation rules:

```json
{
  "trigger": "task.created",
  "action": "webhook.call",
  "config": {
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK"
  }
}
```

Available triggers:

- `task.created`
- `task.status_changed`
- `task.updated`
- `task.due_soon`
- `task.overdue`

Available actions:

- `webhook.call` - Call external webhook
- `notify.user` - Send in-app notification

### Reports & Analytics

```bash
# Burnup chart
GET /reports/burnup/{projectId}?from=2024-01-01&to=2024-12-31

# Team workload
GET /reports/workload/{teamId}
```

### AI Features

```bash
# Auto-suggest tags
POST /ai/auto-tag
{
  "title": "Add login page",
  "description": "Create user authentication UI"
}
# Returns: ["feature", "ui", "auth"]

# Smart assignee suggestion
POST /ai/assign
{
  "taskId": "uuid"
}
# Returns suggested assignee based on workload
```

## Scopes Reference

- `projects:write`: create projects
- `tasks:write`: create/move/update tasks
- `files:write`: upload files
- `teams:write`: create teams
- `comments:write`: post comments

Pass `x-api-key: <key>` to use API keys with scopes; rate limit per minute can be configured per key.

## 🚢 Production Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for comprehensive deployment instructions.

### Quick Deploy

```bash
# 1. Create production resources
wrangler d1 create taskflow-db
wrangler r2 bucket create taskflow-files
wrangler kv:namespace create CACHE

# 2. Update wrangler.toml with resource IDs

# 3. Set secrets
wrangler secret put JWT_SECRET -e production

# 4. Run migrations
wrangler d1 migrations apply taskflow-db -e production

# 5. Deploy
npm run build
wrangler deploy -e production
```

### Automated Deployment

Use the included PowerShell script:

```powershell
.\deploy.ps1 -Environment production
```

## 💰 Cost Estimation

### Cloudflare Workers Paid Plan ($5/month)

**Included:**

- 10M requests/month
- 30M CPU-milliseconds
- 25M D1 row reads
- Unlimited R2 bandwidth (egress free)

**Additional Usage (pay-as-you-go):**

- Requests: $0.50 per additional million
- D1 writes: $1.00 per million
- R2 storage: $0.015 per GB/month
- KV operations: $0.50/M reads, $5/M writes
- Workers AI: $0.011 per 1000 neurons

**Example: Small Team (10 users)**

- 50K requests/month: **Included**
- 500MB R2 storage: **$0.01**
- 500K KV operations: **$0.25**
- 1K AI requests: **$0.01**

**Total: ~$5.27/month** 🎉

### Free Tier Available

Cloudflare offers a generous free tier perfect for:

- Personal projects
- Testing and development
- Small teams (<5 users)
- Low-traffic deployments

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and commit: `git commit -m 'feat: add amazing feature'`
4. Push to your fork: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Powered by [Hono](https://hono.dev/)
- UI built with [React](https://react.dev/)
- Inspired by modern task management tools

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/PythonSmall-Q/Taskflow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/PythonSmall-Q/Taskflow/discussions)

## 🗺️ Roadmap

### ✅ Completed (v0.2.0)
- [x] Mobile-friendly responsive design
- [x] Time tracking with start/stop timers
- [x] Email notifications system
- [x] Custom fields for tasks
- [x] Gantt chart view with critical path
- [x] Advanced AI features (priority prediction, deadline suggestion, time estimation)
- [x] Import/export (JSON, CSV, Jira)
- [x] Task templates and recurring tasks
- [x] Bulk operations

### 🚧 In Progress (v0.3.0)
- [ ] Mobile native apps (React Native)
- [ ] Advanced calendar integration (Google, Outlook)
- [ ] Third-party app integrations (Trello, Asana, Linear)
- [ ] Video attachments support
- [ ] Voice notes for tasks

### 🔮 Future (v0.4.0+)
- [ ] Team chat/messaging
- [ ] Mind map view
- [ ] Portfolio management (multi-project)
- [ ] Resource planning
- [ ] Budget tracking
- [ ] Invoicing integration
- [ ] Client portal
- [ ] Advanced permissions (row-level security)
- [ ] API webhooks v2 (retry, filtering)
- [ ] Plugin system for custom extensions

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ using Cloudflare Workers**

*Deploy globally in seconds, scale infinitely, pay only for what you use.*
