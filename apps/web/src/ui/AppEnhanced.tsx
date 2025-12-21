import React, { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import { Admin } from './Admin'
import { TaskCard, type Task } from './components/TaskCard'
import { TaskEditor } from './components/TaskEditor'
import { TaskCreateModal } from './components/TaskCreateModal'
import { ProjectModal } from './components/ProjectModal'
import { ToastContainer, type Toast } from './components/Toast'

const apiBase = '' // same origin when served by worker

type Project = { id: string; name: string; description?: string; color?: string }

function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }), [token])
  const save = (t: string) => {
    localStorage.setItem('token', t)
    setToken(t)
  }
  return { token, setToken: save, headers }
}

export function App() {
  const { token, setToken, headers } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | 'app' | 'admin'>(token ? 'app' : 'login')
  const [theme, setTheme] = useState<'light'|'dark'>(() => (localStorage.getItem('theme') as any) || 'light')
  const [lang, setLang] = useState<'zh'|'en'>(() => (localStorage.getItem('lang') as any) || 'zh')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [active, setActive] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; key: string; label?: string; created_at: number; revoked: number }>>([])
  const [editorTask, setEditorTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<Record<string, Array<{ id: string; user_id: string; body: string; created_at: number }>>>({})
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [activeTaskForComments, setActiveTaskForComments] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<FileList | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<Task['status'] | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | 'all'>('all')

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  useEffect(() => {
    if (mode === 'app' && token) {
      fetch(apiBase + '/projects', { headers }).then(r => r.json()).then(d => {
        setProjects(d.projects ?? [])
        if (d.projects?.[0]) setActive(d.projects[0])
      }).catch(() => showToast(lang === 'zh' ? '加载项目失败' : 'Failed to load projects', 'error'))
    }
  }, [mode, token])

  useEffect(() => {
    if (active && token) {
      fetch(apiBase + '/tasks/' + active.id, { headers }).then(r => r.json()).then(d => setTasks(d.tasks ?? []))
        .catch(() => showToast(lang === 'zh' ? '加载任务失败' : 'Failed to load tasks', 'error'))
      
      // Connect realtime room for this project
      const socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/realtime/room/' + active.id)
      socket.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg?.type === 'comment.created') {
            fetch(apiBase + '/comments/task/' + msg.taskId, { headers }).then(r => r.json()).then(d => setComments(prev => ({ ...prev, [msg.taskId]: d.comments ?? [] })))
          }
        } catch {}
      }
      socket.onopen = () => {}
      socket.onclose = () => {}
      setWs(socket)
      return () => { socket.close(); setWs(null) }
    }
  }, [active?.id, token])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(apiBase + '/auth/login', { method: 'POST', headers, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (data.token) {
        setToken(data.token)
        setMode('app')
        showToast(lang === 'zh' ? '登录成功' : 'Login successful', 'success')
      } else {
        showToast(data.error || (lang === 'zh' ? '登录失败' : 'Login failed'), 'error')
      }
    } catch {
      showToast(lang === 'zh' ? '登录失败' : 'Login failed', 'error')
    }
  }

  const loadKeys = async () => {
    const res = await fetch(apiBase + '/api-keys', { headers })
    const data = await res.json()
    setApiKeys(data.keys ?? [])
  }

  const createKey = async () => {
    const label = prompt('Key label (optional):') || undefined
    const res = await fetch(apiBase + '/api-keys', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) })
    const data = await res.json()
    alert('New key: ' + data.key)
    await loadKeys()
    showToast(lang === 'zh' ? 'API Key 已创建' : 'API Key created', 'success')
  }

  const revokeKey = async (id: string) => {
    await fetch(apiBase + '/api-keys/revoke/' + id, { method: 'POST', headers })
    await loadKeys()
    showToast(lang === 'zh' ? 'API Key 已撤销' : 'API Key revoked', 'success')
  }

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(apiBase + '/auth/register', { method: 'POST', headers, body: JSON.stringify({ email, password, name }) })
      const data = await res.json()
      if (data.token) {
        setToken(data.token)
        setMode('app')
        showToast(lang === 'zh' ? '注册成功' : 'Registration successful', 'success')
      } else {
        showToast(data.error || (lang === 'zh' ? '注册失败' : 'Registration failed'), 'error')
      }
    } catch {
      showToast(lang === 'zh' ? '注册失败' : 'Registration failed', 'error')
    }
  }

  const handleCreateProject = async (name: string, description: string, color: string) => {
    try {
      const res = await fetch(apiBase + '/projects', { method: 'POST', headers, body: JSON.stringify({ name, description, color }) })
      const data = await res.json()
      if (data.project) {
        setProjects(p => [data.project, ...p])
        setActive(data.project)
        setShowProjectModal(false)
        showToast(lang === 'zh' ? '项目已创建' : 'Project created', 'success')
      }
    } catch {
      showToast(lang === 'zh' ? '创建项目失败' : 'Failed to create project', 'error')
    }
  }

  const handleCreateTask = async (taskData: any) => {
    try {
      const res = await fetch(apiBase + '/tasks', { method: 'POST', headers, body: JSON.stringify(taskData) })
      const data = await res.json()
      if (data.task) {
        setTasks(t => [data.task, ...t])
        setShowTaskModal(false)
        showToast(lang === 'zh' ? '任务已创建' : 'Task created', 'success')
      }
    } catch {
      showToast(lang === 'zh' ? '创建任务失败' : 'Failed to create task', 'error')
    }
  }

  const moveTask = async (task: Task, status: Task['status']) => {
    setTasks(t => t.map(x => (x.id === task.id ? { ...x, status } : x)))
    try {
      await fetch(apiBase + '/tasks/move', { method: 'POST', headers, body: JSON.stringify({ id: task.id, status, rank: Date.now() }) })
    } catch {
      showToast(lang === 'zh' ? '移动任务失败' : 'Failed to move task', 'error')
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination || !active) return
    const destLane = destination.droppableId as Task['status']
    const task = tasks.find(t => t.id === draggableId)
    if (!task) return
    await moveTask(task, destLane)
  }

  const openComments = async (taskId: string) => {
    setActiveTaskForComments(taskId)
    const res = await fetch(apiBase + '/comments/task/' + taskId, { headers })
    const data = await res.json()
    setComments(prev => ({ ...prev, [taskId]: data.comments ?? [] }))
  }

  const openEditor = (task: Task) => {
    setEditorTask(task)
  }

  const saveEditor = async (updates: Partial<Task>) => {
    if (!editorTask) return
    try {
      await fetch(apiBase + '/tasks/' + editorTask.id, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      // Refresh tasks
      if (active) {
        const res = await fetch(apiBase + '/tasks/' + active.id, { headers })
        const data = await res.json()
        setTasks(data.tasks ?? [])
      }
      setEditorTask(null)
      showToast(lang === 'zh' ? '任务已更新' : 'Task updated', 'success')
    } catch {
      showToast(lang === 'zh' ? '更新任务失败' : 'Failed to update task', 'error')
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      // Note: Need to add DELETE endpoint to tasks route
      setTasks(t => t.filter(x => x.id !== taskId))
      showToast(lang === 'zh' ? '任务已删除' : 'Task deleted', 'success')
    } catch {
      showToast(lang === 'zh' ? '删除任务失败' : 'Failed to delete task', 'error')
    }
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTaskForComments) return
    try {
      const form = new FormData()
      form.append('taskId', activeTaskForComments)
      form.append('body', commentText)
      if (commentFiles) {
        Array.from(commentFiles).forEach(f => form.append('files', f))
      }
      const res = await fetch(apiBase + '/comments', { method: 'POST', headers: { Authorization: headers.Authorization! }, body: form })
      const data = await res.json()
      if (data.comment) {
        setCommentText('')
        setCommentFiles(null)
        const r = await fetch(apiBase + '/comments/task/' + activeTaskForComments, { headers })
        const d = await r.json()
        setComments(prev => ({ ...prev, [activeTaskForComments]: d.comments ?? [] }))
        showToast(lang === 'zh' ? '评论已添加' : 'Comment added', 'success')
      }
    } catch {
      showToast(lang === 'zh' ? '评论失败' : 'Failed to add comment', 'error')
    }
  }

  const t = (key: string) => {
    const dict: Record<string, Record<string,string>> = {
      zh: {
        appTitle: 'Taskflow Zero', login: '登录', register: '注册', email: '邮箱', password: '密码', name: '名称', createProject: '新建项目', signOut: '退出', selectProject: '请选择项目', newTask: '新建任务', todo: '待办', in_progress: '进行中', review: '评审', done: '已完成', comment: '评论', editDesc: '编辑描述', send: '发送', close: '关闭', admin: '管理员界面', manageKeys: '管理 API Keys', search: '搜索任务...', filterStatus: '按状态筛选', filterPriority: '按优先级筛选', all: '全部', projects: '项目', haveAccount: '已有账号？', noAccount: '还没有账号？', createAccount: '创建账号'
      },
      en: {
        appTitle: 'Taskflow Zero', login: 'Login', register: 'Register', email: 'Email', password: 'Password', name: 'Name', createProject: 'New Project', signOut: 'Sign Out', selectProject: 'Select a project', newTask: 'New Task', todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done', comment: 'Comment', editDesc: 'Edit Description', send: 'Send', close: 'Close', admin: 'Admin', manageKeys: 'Manage API Keys', search: 'Search tasks...', filterStatus: 'Filter by status', filterPriority: 'Filter by priority', all: 'All', projects: 'Projects', haveAccount: 'Have an account?', noAccount: 'No account?', createAccount: 'Create Account'
      }
    }
    return dict[lang][key] || key
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])
  
  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = !searchQuery || task.title.toLowerCase().includes(searchQuery.toLowerCase()) || task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [tasks, searchQuery, filterStatus, filterPriority])

  if (mode === 'login') return (
    <>
      <div style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>{t('appTitle')}</h1>
        <form onSubmit={onLogin}>
          <input placeholder={t('email')} value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <input placeholder={t('password')} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button type="submit" style={{ width: '100%' }}>{t('login')}</button>
        </form>
        <p style={{ textAlign: 'center' }}>{t('noAccount')} <a href="#" onClick={() => setMode('register')}>{t('register')}</a></p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <label>Theme: <select value={theme} onChange={e=>setTheme(e.target.value as any)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label>Lang: <select value={lang} onChange={e=>setLang(e.target.value as any)}><option value="zh">中文</option><option value="en">English</option></select></label>
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )

  if (mode === 'register') return (
    <>
      <div style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>{t('createAccount')}</h1>
        <form onSubmit={onRegister}>
          <input placeholder={t('name')} value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <input placeholder={t('email')} value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <input placeholder={t('password')} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button type="submit" style={{ width: '100%' }}>{t('register')}</button>
        </form>
        <p style={{ textAlign: 'center' }}>{t('haveAccount')} <a href="#" onClick={() => setMode('login')}>{t('login')}</a></p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <label>Theme: <select value={theme} onChange={e=>setTheme(e.target.value as any)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label>Lang: <select value={lang} onChange={e=>setLang(e.target.value as any)}><option value="zh">中文</option><option value="en">English</option></select></label>
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )

  if (mode === 'admin') return (
    <>
      <Admin headers={headers} theme={theme} lang={lang} />
      <button onClick={() => setMode('app')} style={{ position: 'fixed', top: '1rem', left: '1rem' }}>
        ← {t('appTitle')}
      </button>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )

  const lanes: Task['status'][] = ['todo','in_progress','review','done']

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <strong>{t('appTitle')}</strong>
        <button onClick={() => setShowProjectModal(true)}>{t('createProject')}</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem' }}>Theme: <select value={theme} onChange={e=>setTheme(e.target.value as any)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label style={{ fontSize: '0.875rem' }}>Lang: <select value={lang} onChange={e=>setLang(e.target.value as any)}><option value="zh">中文</option><option value="en">English</option></select></label>
          <button onClick={() => { localStorage.removeItem('token'); location.reload() }}>{t('signOut')}</button>
        </div>
      </header>
      
      <main style={{ display: 'grid', gridTemplateColumns: '280px 1fr', flex: 1, overflow: 'hidden' }}>
        <aside className="sidebar">
          <h3 style={{ marginTop: 0 }}>{t('projects')}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {projects.map(p => (
              <li key={p.id}>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setActive(p) }}
                  className={`sidebar-link ${active?.id === p.id ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {p.color && <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: p.color }} />}
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '1.5rem' }}>
            <button onClick={loadKeys} style={{ width: '100%', marginBottom: '0.5rem' }}>{t('manageKeys')}</button>
            <button onClick={() => setMode('admin')} style={{ width: '100%', background: 'transparent', color: 'var(--text)' }}>{t('admin')}</button>
          </div>
          {!!apiKeys.length && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>API Keys</h4>
              <div style={{ marginBottom: '0.5rem' }}>
                <button onClick={createKey} style={{ width: '100%', fontSize: '0.75rem', padding: '0.375rem' }}>Create Key</button>
              </div>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {apiKeys.map(k => (
                  <li key={k.id} className="card" style={{ fontSize: '0.75rem', padding: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 500 }}>{k.label || '(no label)'}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.625rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.key}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.625rem' }}>{new Date(k.created_at).toLocaleDateString()}</div>
                    {!k.revoked && <button onClick={() => revokeKey(k.id)} style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.625rem', padding: '0.25rem', background: '#ef4444' }}>Revoke</button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
        
        <section style={{ padding: '1.5rem', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{active?.name ?? t('selectProject')}</h2>
            {active && <button onClick={() => setShowTaskModal(true)}>{t('newTask')}</button>}
          </div>

          {active && (
            <>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input
                  type="search"
                  placeholder={t('search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, minWidth: '200px' }}
                />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} style={{ minWidth: '150px' }}>
                  <option value="all">{t('filterStatus')}: {t('all')}</option>
                  <option value="todo">{t('todo')}</option>
                  <option value="in_progress">{t('in_progress')}</option>
                  <option value="review">{t('review')}</option>
                  <option value="done">{t('done')}</option>
                </select>
                <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as any)} style={{ minWidth: '150px' }}>
                  <option value="all">{t('filterPriority')}: {t('all')}</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {lanes.map(l => (
                    <Droppable droppableId={l} key={l}>
                      {provided => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="lane">
                          <h4 className="lane-header">{t(l)} ({filteredTasks.filter(t => t.status === l).length})</h4>
                          {filteredTasks.filter(t => t.status === l).map((task, idx) => (
                            <Draggable draggableId={task.id} index={idx} key={task.id}>
                              {prov => (
                                <TaskCard
                                  task={task}
                                  provided={prov}
                                  onComment={openComments}
                                  onEdit={openEditor}
                                  onDelete={deleteTask}
                                  lang={lang}
                                />
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  ))}
                </div>
              </DragDropContext>
            </>
          )}

          {/* Comments panel */}
          {activeTaskForComments && (
            <div className="card" style={{ marginTop: '2rem' }}>
              <h3>{t('comment')}</h3>
              <div>
                {(comments[activeTaskForComments] ?? []).map(c => (
                  <div key={c.id} className="comment">
                    <div className="comment-header">
                      <span>{c.user_id}</span>
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <ReactMarkdown>{c.body}</ReactMarkdown>
                  </div>
                ))}
              </div>
              <form onSubmit={submitComment} style={{ marginTop: '1rem' }}>
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={lang==='zh'?'支持 Markdown, 可@邮箱或@用户ID':'Markdown supported, @email or @userID'} style={{ width: '100%', height: 100 }} />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <input type="file" multiple onChange={e => setCommentFiles(e.target.files)} />
                  <button type="submit">{t('send')}</button>
                  <button type="button" onClick={() => setActiveTaskForComments(null)} style={{ background: 'transparent', color: 'var(--text)' }}>{t('close')}</button>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>

      {showProjectModal && (
        <ProjectModal onSave={handleCreateProject} onClose={() => setShowProjectModal(false)} lang={lang} />
      )}

      {showTaskModal && active && (
        <TaskCreateModal projectId={active.id} onSave={handleCreateTask} onClose={() => setShowTaskModal(false)} lang={lang} />
      )}

      {editorTask && (
        <TaskEditor task={editorTask} onSave={saveEditor} onClose={() => setEditorTask(null)} lang={lang} />
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
