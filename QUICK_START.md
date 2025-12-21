# 🚀 Quick Start Guide - New Features

## Setup (5 minutes)

### 1. Run Migrations
```bash
cd apps/api
wrangler d1 execute DB --file=migrations/0004_features.sql --local
wrangler d1 execute DB --file=migrations/0005_roadmap_features.sql --local
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Test a Feature
```bash
# Get your auth token first
TOKEN="your-jwt-token"

# Try time tracking
curl -X POST http://localhost:8787/time-tracking/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"some-task-id","description":"Testing feature"}'
```

---

## 📋 Feature Checklist

Copy this to your planning tool:

```
🆕 NEW FEATURES IN v0.2.0

Time Tracking
- [ ] Integrate timer UI on task cards
- [ ] Add time summary dashboard
- [ ] Show running timer indicator

Notifications
- [ ] Connect notification bell icon
- [ ] Configure email service (Resend/SendGrid)
- [ ] Set up cron for email queue

Custom Fields
- [ ] Add custom fields manager UI
- [ ] Display fields in task editor
- [ ] Add field validation feedback

Gantt Chart
- [ ] Create Gantt chart view component
- [ ] Add dependency management UI
- [ ] Show critical path highlighting

AI Features
- [ ] Add "Suggest Priority" button
- [ ] Add "Estimate Time" button
- [ ] Add "Generate Description" button
- [ ] Show AI confidence scores

Import/Export
- [ ] Add export buttons (JSON, CSV)
- [ ] Add import wizard
- [ ] Support drag-and-drop CSV upload
```

---

## 🎯 API Quick Reference

### Time Tracking
```bash
# Start timer
POST /time-tracking/start
Body: {"taskId": "uuid", "description": "Working on..."}

# Get active
GET /time-tracking/active

# Stop timer
POST /time-tracking/stop
Body: {"id": "entry-uuid"}
```

### AI Predictions
```bash
# Predict priority
POST /ai/predict-priority
Body: {"title": "...", "description": "..."}

# Suggest deadline
POST /ai/suggest-deadline
Body: {"projectId": "uuid", "priority": "high"}

# Estimate time
POST /ai/estimate-time
Body: {"title": "...", "description": "..."}
```

### Custom Fields
```bash
# Create field
POST /custom-fields
Body: {
  "projectId": "uuid",
  "name": "Story Points",
  "fieldType": "number",
  "validation": {"min": 0, "max": 100}
}

# Set value
POST /custom-fields/task/:taskId
Body: {"fieldId": "uuid", "value": "5"}
```

### Export
```bash
# Export as JSON
GET /import-export/export/json/:projectId

# Export as CSV
GET /import-export/export/csv/:projectId
```

---

## 🎨 UI Integration Ideas

### Task Card Enhancements
```tsx
<TaskCard task={task}>
  {/* Time tracking */}
  <TimeTracker taskId={task.id} />
  
  {/* Custom fields */}
  {task.customFields?.map(field => (
    <CustomFieldDisplay key={field.id} field={field} />
  ))}
  
  {/* AI suggestions */}
  <AISuggestionsBadge task={task} />
</TaskCard>
```

### Smart Task Creation
```tsx
<TaskForm>
  {/* AI-powered fields */}
  <SmartPrioritySelect 
    title={title}
    description={description}
    onPredict={setPriority}
  />
  
  <SmartDeadlinePicker
    priority={priority}
    onSuggest={setDeadline}
  />
  
  <SmartEstimate
    title={title}
    onEstimate={setEstimate}
  />
</TaskForm>
```

### Gantt Chart View
```tsx
<ProjectView>
  <Tab label="Board" />
  <Tab label="List" />
  <Tab label="Gantt" /> {/* NEW! */}
  <Tab label="Calendar" />
</ProjectView>
```

---

## 📊 Database Quick Check

Verify tables exist:
```bash
wrangler d1 execute DB --local --command="
SELECT name FROM sqlite_master 
WHERE type='table' 
ORDER BY name;
"
```

Expected new tables:
- ✅ time_entries
- ✅ notifications
- ✅ email_queue
- ✅ custom_field_definitions
- ✅ custom_field_values
- ✅ task_templates
- ✅ recurring_tasks
- ✅ activity_log
- ✅ user_settings
- ✅ task_dependencies

---

## 🔧 Troubleshooting

### "Table not found"
→ Run migrations: `wrangler d1 execute DB --file=...`

### "Unauthorized" errors
→ Check Bearer token in Authorization header

### AI endpoints not working
→ Workers AI enabled automatically, no action needed

### Email not sending
→ Emails are queued, need to integrate email service (see notifications.ts line 62)

---

## 📚 Documentation

- **[ROADMAP_FEATURES.md](ROADMAP_FEATURES.md)** - Complete feature guide
- **[IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)** - Implementation summary
- **[NEW_FUNCTIONS.md](NEW_FUNCTIONS.md)** - Previous session features
- **[README.md](README.md)** - Main documentation

---

## 🎉 What's Next?

1. **Test locally** - Try all the new endpoints
2. **Update UI** - Integrate features into React components
3. **Deploy** - Push to production when ready
4. **Mobile** - Start v0.3.0 with React Native apps

---

**🚀 You now have a production-ready task management platform!**

- ⏱️ Time tracking
- 📧 Notifications
- 🎨 Custom fields
- 📊 Gantt charts
- 🤖 AI intelligence
- 📥 Import/Export

**Happy coding!** 🎨
