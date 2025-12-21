import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const customFields = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// List custom field definitions for a project
customFields.get('/project/:projectId', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  const fields = await all(
    c.env,
    `SELECT cf.* FROM custom_field_definitions cf
     JOIN projects p ON cf.project_id = p.id
     JOIN team_members m ON m.team_id = p.team_id
     WHERE cf.project_id = ? AND m.user_id = ?
     ORDER BY cf.display_order ASC`,
    projectId,
    user.sub
  )
  
  return c.json({
    fields: fields.map((f: any) => ({
      ...f,
      options: f.options ? JSON.parse(f.options) : null,
      validation: f.validation ? JSON.parse(f.validation) : null
    }))
  })
})

// Create custom field definition
customFields.post('/', requireScope('projects:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { projectId, name, fieldType, required, options, validation, displayOrder } = body
  
  if (!projectId || !name || !fieldType) {
    return c.json({ error: 'projectId, name, and fieldType required' }, 400)
  }
  
  const validTypes = ['text', 'number', 'date', 'select', 'multi-select', 'checkbox', 'url', 'email']
  if (!validTypes.includes(fieldType)) {
    return c.json({ error: `fieldType must be one of: ${validTypes.join(', ')}` }, 400)
  }
  
  const id = crypto.randomUUID()
  await run(
    c.env,
    `INSERT INTO custom_field_definitions (id, project_id, name, field_type, required, options, validation, display_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    projectId,
    name,
    fieldType,
    required ? 1 : 0,
    options ? JSON.stringify(options) : null,
    validation ? JSON.stringify(validation) : null,
    displayOrder || 0,
    Date.now()
  )
  
  return c.json({ field: { id, name, fieldType } }, 201)
})

// Update custom field definition
customFields.patch('/:id', requireScope('projects:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  const body = await c.req.json()
  const updates: string[] = []
  const values: any[] = []
  
  if (body.name) { updates.push('name = ?'); values.push(body.name) }
  if (body.required !== undefined) { updates.push('required = ?'); values.push(body.required ? 1 : 0) }
  if (body.options) { updates.push('options = ?'); values.push(JSON.stringify(body.options)) }
  if (body.validation) { updates.push('validation = ?'); values.push(JSON.stringify(body.validation)) }
  if (body.displayOrder !== undefined) { updates.push('display_order = ?'); values.push(body.displayOrder) }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  await run(
    c.env,
    `UPDATE custom_field_definitions SET ${updates.join(', ')} WHERE id = ?`,
    ...values,
    id
  )
  
  return c.json({ ok: true })
})

// Delete custom field definition
customFields.delete('/:id', requireScope('projects:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  // Delete all values first
  await run(c.env, 'DELETE FROM custom_field_values WHERE field_id = ?', id)
  
  // Delete definition
  await run(c.env, 'DELETE FROM custom_field_definitions WHERE id = ?', id)
  
  return c.json({ ok: true })
})

// Get custom field values for a task
customFields.get('/task/:taskId', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const taskId = c.req.param('taskId')
  
  const values = await all(
    c.env,
    `SELECT cfv.*, cfd.name, cfd.field_type
     FROM custom_field_values cfv
     JOIN custom_field_definitions cfd ON cfv.field_id = cfd.id
     WHERE cfv.task_id = ?
     ORDER BY cfd.display_order ASC`,
    taskId
  )
  
  return c.json({
    values: values.map((v: any) => ({
      fieldId: v.field_id,
      name: v.name,
      fieldType: v.field_type,
      value: v.value
    }))
  })
})

// Set custom field value for a task
customFields.post('/task/:taskId', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const taskId = c.req.param('taskId')
  
  const body = await c.req.json()
  const { fieldId, value } = body
  
  if (!fieldId) return c.json({ error: 'fieldId required' }, 400)
  
  // Check if field definition exists
  const field = await one<any>(
    c.env,
    `SELECT * FROM custom_field_definitions WHERE id = ? LIMIT 1`,
    fieldId
  )
  
  if (!field) return c.json({ error: 'Field definition not found' }, 404)
  
  // Validate value based on field type
  if (field.required && (value === null || value === undefined || value === '')) {
    return c.json({ error: 'Field is required' }, 400)
  }
  
  if (field.validation) {
    const validation = JSON.parse(field.validation)
    
    // Number validation
    if (field.field_type === 'number') {
      const num = parseFloat(value)
      if (isNaN(num)) return c.json({ error: 'Value must be a number' }, 400)
      if (validation.min !== undefined && num < validation.min) {
        return c.json({ error: `Value must be >= ${validation.min}` }, 400)
      }
      if (validation.max !== undefined && num > validation.max) {
        return c.json({ error: `Value must be <= ${validation.max}` }, 400)
      }
    }
    
    // Text validation
    if (field.field_type === 'text') {
      if (validation.minLength && value.length < validation.minLength) {
        return c.json({ error: `Value must be at least ${validation.minLength} characters` }, 400)
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return c.json({ error: `Value must be at most ${validation.maxLength} characters` }, 400)
      }
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern)
        if (!regex.test(value)) {
          return c.json({ error: 'Value does not match required pattern' }, 400)
        }
      }
    }
  }
  
  // Upsert value
  const existing = await one(
    c.env,
    'SELECT id FROM custom_field_values WHERE task_id = ? AND field_id = ? LIMIT 1',
    taskId,
    fieldId
  )
  
  if (existing) {
    await run(
      c.env,
      'UPDATE custom_field_values SET value = ?, updated_at = ? WHERE task_id = ? AND field_id = ?',
      value,
      Date.now(),
      taskId,
      fieldId
    )
  } else {
    const id = crypto.randomUUID()
    await run(
      c.env,
      `INSERT INTO custom_field_values (id, task_id, field_id, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      taskId,
      fieldId,
      value,
      Date.now(),
      Date.now()
    )
  }
  
  return c.json({ ok: true })
})

// Delete custom field value
customFields.delete('/task/:taskId/:fieldId', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const taskId = c.req.param('taskId')
  const fieldId = c.req.param('fieldId')
  
  await run(
    c.env,
    'DELETE FROM custom_field_values WHERE task_id = ? AND field_id = ?',
    taskId,
    fieldId
  )
  
  return c.json({ ok: true })
})

export default customFields
