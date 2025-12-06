import React, { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import ReactMarkdown from 'react-markdown'

const apiBase = '' // same origin when served by worker

type Project = { id: string; name: string }

type Task = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  key: string
}

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
  const [mode, setMode] = useState<'login' | 'register' | 'app'>(token ? 'app' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [active, setActive] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    if (mode === 'app' && token) {
      fetch(apiBase + '/projects', { headers }).then(r => r.json()).then(d => {
        setProjects(d.projects ?? [])
        if (d.projects?.[0]) setActive(d.projects[0])
      })
    }
  }, [mode, token])

  useEffect(() => {
    if (active && token) {
      fetch(apiBase + '/tasks/' + active.id, { headers }).then(r => r.json()).then(d => setTasks(d.tasks ?? []))
    }
  }, [active?.id, token])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(apiBase + '/auth/login', { method: 'POST', headers, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (data.token) { setToken(data.token); setMode('app') }
    else alert('登录失败')
  }

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(apiBase + '/auth/register', { method: 'POST', headers, body: JSON.stringify({ email, password, name }) })
    const data = await res.json()
    if (data.token) { setToken(data.token); setMode('app') }
    else alert('注册失败')
  }

  const createProject = async () => {
    const name = prompt('项目名称')?.trim()
    if (!name) return
    const res = await fetch(apiBase + '/projects', { method: 'POST', headers, body: JSON.stringify({ name }) })
    const data = await res.json()
    if (data.project) { setProjects(p => [data.project, ...p]); setActive(data.project) }
  }

  const createTask = async () => {
    if (!active) return
    const title = prompt('任务标题')?.trim()
    if (!title) return
    const res = await fetch(apiBase + '/tasks', { method: 'POST', headers, body: JSON.stringify({ projectId: active.id, title }) })
    const data = await res.json()
    if (data.task) setTasks(t => [data.task, ...t])
  }

  const moveTask = async (task: Task, status: Task['status']) => {
    setTasks(t => t.map(x => (x.id === task.id ? { ...x, status } : x)))
    await fetch(apiBase + '/tasks/move', { method: 'POST', headers, body: JSON.stringify({ id: task.id, status, rank: Date.now() }) })
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination || !active) return
    const destLane = destination.droppableId as Task['status']
    const task = tasks.find(t => t.id === draggableId)
    if (!task) return
    await moveTask(task, destLane)
  }

  if (mode === 'login') return (
    <div style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Taskflow Zero</h1>
      <form onSubmit={onLogin}>
        <input placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <input placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <button type="submit" style={{ width: '100%' }}>登录</button>
      </form>
      <p>还没有账号？ <a href="#" onClick={() => setMode('register')}>注册</a></p>
    </div>
  )

  if (mode === 'register') return (
    <div style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>创建账号</h1>
      <form onSubmit={onRegister}>
        <input placeholder="名称" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <input placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <input placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <button type="submit" style={{ width: '100%' }}>注册</button>
      </form>
      <p>已有账号？ <a href="#" onClick={() => setMode('login')}>登录</a></p>
    </div>
  )

  const lanes: Task['status'][] = ['todo','in_progress','review','done']

  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#111827', color: 'white' }}>
        <strong>Taskflow Zero</strong>
        <button onClick={createProject}>新建项目</button>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => { localStorage.removeItem('token'); location.reload() }}>退出</button>
        </div>
      </header>
      <main style={{ display: 'grid', gridTemplateColumns: '240px 1fr' }}>
        <aside style={{ borderRight: '1px solid #e5e7eb', padding: 12 }}>
          <h3>项目</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {projects.map(p => (
              <li key={p.id}>
                <a href="#" onClick={() => setActive(p)} style={{ color: active?.id === p.id ? '#7c3aed' : '#111827' }}>{p.name}</a>
              </li>
            ))}
          </ul>
        </aside>
        <section style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>{active?.name ?? '请选择项目'}</h2>
            {active && <button onClick={createTask}>新建任务</button>}
          </div>
          {active && (
            <DragDropContext onDragEnd={onDragEnd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 12 }}>
                {lanes.map(l => (
                  <Droppable droppableId={l} key={l}>
                    {provided => (
                      <div ref={provided.innerRef} {...provided.droppableProps} style={{ background: '#f3f4f6', borderRadius: 8, padding: 8, minHeight: 300 }}>
                        <h4 style={{ marginTop: 0 }}>
                          {l === 'todo' ? '待办' : l === 'in_progress' ? '进行中' : l === 'review' ? '评审' : '已完成'}
                        </h4>
                        {tasks.filter(t => t.status === l).map((t, idx) => (
                          <Draggable draggableId={t.id} index={idx} key={t.id}>
                            {prov => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} style={{ background: 'white', borderRadius: 6, padding: 8, marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>{t.key}</div>
                                <div>{t.title}</div>
                              </div>
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
          )}
        </section>
      </main>
    </div>
  )
}
