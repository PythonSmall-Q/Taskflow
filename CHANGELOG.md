# Changelog

All notable changes to Taskflow Zero will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-12-21

### Added

- 🎨 Enhanced UI with modern styling and animations
- 🎯 Advanced task filtering (search, status, priority)
- 📝 Rich task editor with Markdown preview
- 🎨 Project creation modal with color selection
- 🎨 Task creation modal with full field support
- 📱 Responsive task cards with priority indicators
- 🔔 Toast notification system
- 🎨 Improved theme support (light/dark modes)
- 📋 Enhanced task properties (priority, due dates, labels)
- 🗑️ Task deletion functionality
- ⚡ Better error handling and user feedback
- 📚 Comprehensive deployment guide
- 📖 Contributing guidelines
- 🔧 Automated deployment script (PowerShell)
- 📝 Environment configuration templates
- 🎯 Production-ready configurations

### Changed

- ♻️ Refactored App component for better maintainability
- 🎨 Improved component structure with separate files
- 📝 Enhanced PATCH endpoint to support multiple fields
- 🔄 Better state management for UI components
- 📚 Updated README with detailed documentation
- 🎨 Modernized CSS with CSS variables and transitions

### Fixed

- 🐛 Fixed duplicate ReactMarkdown import
- 🐛 Fixed undefined variables in App component
- 🐛 Added missing Env type import
- 🐛 Fixed task update not refreshing UI properly
- ⚡ Fixed TypeScript compilation errors
- 🔧 Added missing type definitions for dependencies

## [0.1.0] - 2025-11-29

### Added

- 🚀 Initial release
- ✨ Core task management (CRUD operations)
- 📊 Kanban board with drag-and-drop
- 💬 Comments system with Markdown support
- 📎 File attachments
- 🔐 JWT authentication
- 👥 Team management
- 🔑 API key system with scopes
- ⚡ Real-time updates via WebSockets
- 🤖 Automation triggers and webhooks
- 📈 Basic reports (burnup, workload)
- 🔗 Integration stubs (Slack, Discord, Google Calendar)
- 🧠 AI integration stubs (auto-tagging, assignment)
- 📱 PWA support
- 🌐 Multi-language support (Chinese, English)
- 📝 OpenAPI documentation
- 🗄️ Database migrations
- 🎨 Basic UI with theme support

### Technical

- ⚡ Cloudflare Workers
- 🗄️ D1 SQLite database
- 📦 R2 object storage
- 🔑 KV namespace for caching
- 🌐 Durable Objects for WebSockets
- 🎨 React 18 frontend
- ⚡ Vite build system
- 📝 TypeScript throughout
- 🔒 Security: rate limiting, CORS, input validation

## [Unreleased]

### Planned

- Mobile apps (React Native)
- Gantt chart view
- Time tracking
- Advanced AI features
- Email notifications
- Import/export functionality
- Custom fields
- Task templates
- Recurring tasks
- Advanced analytics
- SSO integration (SAML, OIDC)
- Audit logs
- Advanced permissions
- Task dependencies
- Subtasks
- Custom workflows

---

For more details on any release, see the [commit history](https://github.com/PythonSmall-Q/Taskflow/commits/master).
