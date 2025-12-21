# Contributing to Taskflow Zero

Thank you for your interest in contributing to Taskflow Zero! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare Wrangler CLI
- Git
- A Cloudflare account (for testing Workers features)

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/Taskflow.git
cd Taskflow
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up local database**

```bash
wrangler d1 create taskflow-db --config wrangler.toml
wrangler d1 migrations apply taskflow-db --local --config wrangler.toml
```

4. **Start development server**

```bash
npm run dev
# or
npm --workspace @taskflow/api run dev
```

5. **In a separate terminal, start the web dev server** (optional, for hot reload)

```bash
npm --workspace @taskflow/web run dev
```

## Project Structure

```
Taskflow/
├── apps/
│   ├── api/              # Cloudflare Workers API (Hono)
│   │   ├── migrations/   # D1 database migrations
│   │   ├── src/
│   │   │   ├── routes/   # API route handlers
│   │   │   ├── durable-objects/  # Real-time WebSocket handlers
│   │   │   ├── middleware.ts     # Auth, rate limiting
│   │   │   └── index.ts          # Main entry point
│   │   └── tests/        # API tests
│   └── web/              # React PWA frontend
│       └── src/
│           └── ui/       # React components
├── packages/
│   └── shared/           # Shared types/utilities
└── wrangler.toml         # Cloudflare Workers config
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update types in TypeScript files

### 3. Test Your Changes

```bash
# Type check
npm run typecheck

# Run tests
npm test

# Build to verify no errors
npm run build
```

### 4. Commit Your Changes

We use conventional commits:

```bash
git commit -m "feat: add task filtering by priority"
git commit -m "fix: resolve WebSocket connection issue"
git commit -m "docs: update API documentation"
git commit -m "style: improve task card layout"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Reference any related issues
- Screenshots (for UI changes)
- Testing instructions

## Coding Standards

### TypeScript

- Use strict TypeScript (`strict: true`)
- Define proper types, avoid `any`
- Use interfaces for object shapes
- Use `type` for unions/intersections

Example:
```typescript
// Good
interface Task {
  id: string
  title: string
  status: TaskStatus
}

// Avoid
const task: any = { ... }
```

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript for props
- Extract reusable logic into custom hooks

Example:
```tsx
interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  // Component logic
}
```

### API Routes

- Use Hono context types
- Validate input with Zod
- Return proper HTTP status codes
- Handle errors gracefully

Example:
```typescript
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1)
})

tasks.post('/', async (c) => {
  const body = await c.req.json()
  const result = schema.safeParse(body)
  
  if (!result.success) {
    return c.json({ error: result.error }, 400)
  }
  
  // Process request
  return c.json({ task: result.data }, 201)
})
```

### Database

- Always use parameterized queries
- Handle errors appropriately
- Use transactions for related operations
- Add migrations for schema changes

Example:
```typescript
// Good - parameterized
await env.DB.prepare('SELECT * FROM tasks WHERE id = ?')
  .bind(taskId)
  .first()

// Bad - SQL injection risk
await env.DB.prepare(`SELECT * FROM tasks WHERE id = '${taskId}'`).first()
```

## Adding Features

### New API Endpoint

1. Create or update route in `apps/api/src/routes/`
2. Add route to `apps/api/src/index.ts`
3. Update OpenAPI spec in `apps/api/openapi.yaml`
4. Add tests in `apps/api/tests/`
5. Update documentation

### New UI Component

1. Create component in `apps/web/src/ui/components/`
2. Export types if needed
3. Add to relevant parent component
4. Update styles in `apps/web/src/styles.css`
5. Test responsiveness

### Database Migration

1. Create new migration file in `apps/api/migrations/`
2. Use sequential numbering: `0004_description.sql`
3. Include both UP and rollback logic if possible
4. Test migration locally:

```bash
wrangler d1 migrations apply taskflow-db --local
```

Example migration:
```sql
-- Add priority column to tasks
ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium';

-- Add index
CREATE INDEX idx_tasks_priority ON tasks(priority);
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Manual Testing

1. Start dev server: `npm run dev`
2. Open http://localhost:8787
3. Test your changes
4. Check browser console for errors
5. Test in multiple browsers

## Documentation

- Update README.md for user-facing changes
- Update DEPLOYMENT.md for deployment changes
- Add JSDoc comments for complex functions
- Update API documentation
- Add inline comments for tricky logic

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Follow commit message format**
5. **Provide clear PR description**:
   - What changed
   - Why it changed
   - How to test it
6. **Request review** from maintainers
7. **Address feedback** promptly

## Questions?

- Open an issue for bugs
- Start a discussion for feature ideas
- Check existing issues/PRs first
- Ask in discussions for help

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to Taskflow Zero! 🎉
