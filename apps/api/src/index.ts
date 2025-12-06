import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { poweredBy } from 'hono/powered-by'
import type { Env } from './types'
import { auth } from './routes/auth'
import { teams } from './routes/teams'
import { projects } from './routes/projects'
import { tasks } from './routes/tasks'
import { files } from './routes/files'
import { realtime } from './routes/realtime'
import { oauth } from './routes/oauth'
import { ai } from './routes/ai'
import { automation } from './routes/automation'
import { reports } from './routes/reports'
import { integrations } from './routes/integrations'
import { processor } from './routes/processor'
import { comments } from './routes/comments'
import { apiKeys } from './routes/api-keys'
import { admin } from './routes/admin'
import openapiSpec from '../openapi.yaml' assert { type: 'yaml' }
import { rateLimit } from './middleware'
export { RoomDurableObject } from './durable-objects/room'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', poweredBy())
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization'] }))
app.use('*', rateLimit(300, 60_000))

app.get('/', c => c.json({ ok: true, name: 'Taskflow Zero API' }))
app.get('/openapi.yaml', c => c.text(openapiSpec as unknown as string, 200, { 'content-type': 'application/yaml' }))
app.get('/openapi.json', c => c.json(openapiSpec))
app.get('/docs', c => c.html(`<!doctype html><html><head><title>Taskflow API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head><body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui' });</script>
</body></html>`))

app.route('/auth', auth)
app.route('/teams', teams)
app.route('/projects', projects)
app.route('/tasks', tasks)
app.route('/files', files)
app.route('/realtime', realtime)
app.route('/oauth', oauth)
app.route('/ai', ai)
app.route('/automation', automation)
app.route('/reports', reports)
app.route('/integrations', integrations)
app.route('/internal', processor)
app.route('/comments', comments)
app.route('/api-keys', apiKeys)
app.route('/admin', admin)

export default app
