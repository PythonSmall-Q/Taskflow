# Taskflow Zero - Quick Reference

## 🚀 Quick Commands

```bash
# Setup
npm install                          # Install dependencies
npm run setup                        # Full setup (install + migrate + build)

# Development
npm run dev                          # Start dev server (API + Web)
npm run dev:web                      # Start web dev server only
npm run typecheck                    # Check TypeScript
npm test                             # Run tests
npm run format                       # Format code

# Database
npm run migrate                      # Run migrations (local)
npm run migrate:prod                 # Run migrations (production)

# Deployment
npm run build                        # Build everything
npm run deploy                       # Build + Deploy to production
npm run deploy:dry                   # Dry run deployment
npm run logs                         # View production logs

# PowerShell Script
.\deploy.ps1                         # Deploy (interactive)
.\deploy.ps1 -Environment production # Deploy to production
.\deploy.ps1 -SkipBuild             # Deploy without rebuilding
```

## 📁 Project Structure

```
apps/api/              → Cloudflare Workers API
  src/routes/          → API endpoints
  src/durable-objects/ → WebSocket handlers
  migrations/          → Database migrations
apps/web/             → React PWA
  src/ui/             → React components
  src/styles.css      → Global styles
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare Workers config |
| `package.json` | Dependencies & scripts |
| `tsconfig.json` | TypeScript config |
| `vite.config.ts` | Vite build config |
| `.env.example` | Environment template |

## 🌐 API Endpoints

### Auth
- `POST /auth/register` - Create account
- `POST /auth/login` - Login

### Projects
- `GET /projects` - List projects
- `POST /projects` - Create project

### Tasks
- `GET /tasks/{projectId}` - List tasks
- `POST /tasks` - Create task
- `PATCH /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task
- `POST /tasks/move` - Move task

### Comments
- `GET /comments/task/{taskId}` - List comments
- `POST /comments` - Add comment

### API Keys
- `GET /api-keys` - List keys
- `POST /api-keys` - Create key
- `POST /api-keys/config/{id}` - Configure key
- `POST /api-keys/revoke/{id}` - Revoke key

### Real-time
- `GET /realtime/room/{projectId}` - WebSocket connection

### Admin
- `GET /admin/teams/{id}/members` - List team members
- `POST /admin/teams/{id}/members/{userId}/role` - Set role
- `POST /admin/projects/{id}/archive` - Archive project

### Reports
- `GET /reports/burnup/{projectId}` - Burnup chart
- `GET /reports/workload/{teamId}` - Workload stats

### Integration
- `POST /integrations/notify` - Send notification
- `POST /integrations/calendar` - Create calendar event

### AI
- `POST /ai/auto-tag` - Auto-tag task
- `POST /ai/assign` - Suggest assignee

## 🎨 UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `App` | `ui/App.tsx` | Main app container |
| `Admin` | `ui/Admin.tsx` | Admin interface |
| `TaskCard` | `ui/components/TaskCard.tsx` | Task card component |
| `TaskEditor` | `ui/components/TaskEditor.tsx` | Edit task modal |
| `TaskCreateModal` | `ui/components/TaskCreateModal.tsx` | Create task modal |
| `ProjectModal` | `ui/components/ProjectModal.tsx` | Create project modal |
| `Toast` | `ui/components/Toast.tsx` | Notification system |

## 🔐 Environment Variables

```bash
JWT_SECRET=your-secret              # Required
GOOGLE_CLIENT_ID=xxx                # Optional (OAuth)
GOOGLE_CLIENT_SECRET=xxx            # Optional (OAuth)
GITHUB_CLIENT_ID=xxx                # Optional (OAuth)
GITHUB_CLIENT_SECRET=xxx            # Optional (OAuth)
```

## 📊 Database Schema

### Main Tables
- `users` - User accounts
- `teams` - Team organizations
- `team_members` - Team membership
- `projects` - Projects
- `tasks` - Task items
- `comments` - Task comments
- `api_keys` - API authentication
- `automations` - Automation rules
- `webhooks` - Webhook endpoints
- `notifications` - User notifications

## 🎯 Task Properties

```typescript
{
  id: string                    // UUID
  title: string                 // Task title
  description?: string          // Markdown description
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: number            // Timestamp
  labels?: string[]            // Tags
  key: string                  // TASK-0001
  rank: number                 // Sort order
}
```

## 🎨 Theme Variables

```css
--primary: #7c3aed           /* Primary color */
--bg: var(--bg-light|dark)   /* Background */
--text: var(--text-light|dark) /* Text color */
--border: var(--border-light|dark) /* Borders */
--card: var(--card-light|dark) /* Card background */
```

## 🔑 API Key Scopes

- `projects:read` - View projects
- `projects:write` - Create/edit projects
- `tasks:read` - View tasks
- `tasks:write` - Create/edit tasks
- `files:read` - View files
- `files:write` - Upload files
- `comments:read` - View comments
- `comments:write` - Add comments
- `teams:write` - Manage teams

## 📱 Keyboard Shortcuts (Planned)

- `N` - New task
- `P` - New project
- `F` - Focus search
- `/` - Command palette
- `Esc` - Close modal

## 🐛 Troubleshooting

### Database not found
```bash
wrangler d1 list
wrangler d1 migrations apply taskflow-db --local
```

### Build errors
```bash
rm -rf node_modules
npm install
npm run build
```

### Type errors
```bash
npm run typecheck
```

### WebSocket issues
- Check Durable Objects are enabled
- Verify `ROOM_DO` binding in wrangler.toml
- Test with: `wscat -c ws://localhost:8787/realtime/room/test`

## 📚 Documentation Links

- [Full README](README.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [API Docs](http://localhost:8787/docs) (when running)

## 🆘 Getting Help

1. Check [GitHub Issues](https://github.com/PythonSmall-Q/Taskflow/issues)
2. Read documentation files
3. Check Cloudflare Workers docs
4. Open a new issue with details

## 🎉 First Time Setup

```bash
# 1. Clone and install
git clone https://github.com/PythonSmall-Q/Taskflow.git
cd Taskflow
npm install

# 2. Setup database
wrangler d1 create taskflow-db
# Update wrangler.toml with database ID
wrangler d1 migrations apply taskflow-db --local

# 3. Build and run
npm run build
npm run dev

# 4. Open browser
# http://localhost:8787
```

## 💡 Pro Tips

- Use `npm run setup` for fresh installs
- Run `npm run dev:web` for faster frontend development
- Check `wrangler tail` for real-time logs
- Use `--dry-run` to test deployments
- Enable GitHub Actions for auto-deploy
- Set strong JWT_SECRET in production
- Monitor costs in Cloudflare dashboard

---

**Need more info?** Check the full documentation files! 📚
