import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const apiBase = ''

export function Admin({ headers, theme = 'light', lang = 'zh' }: { headers: Record<string, string>, theme?: 'light'|'dark', lang?: 'zh'|'en' }) {
  const [teamId, setTeamId] = useState('')
  const [members, setMembers] = useState<Array<{ user_id: string; role: string }>>([])
  const [settingsText, setSettingsText] = useState('{}')
  const [projectId, setProjectId] = useState('')
  const [archivedMsg, setArchivedMsg] = useState('')
  const [message, setMessage] = useState('')

  const loadMembers = async () => {
    if (!teamId) return
    const res = await fetch(apiBase + `/admin/teams/${teamId}/members`, { headers })
    const data = await res.json()
    setMembers(data.members ?? [])
  }
  const setRole = async (userId: string, role: string) => {
    await fetch(apiBase + `/admin/teams/${teamId}/members/${userId}/role`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    await loadMembers()
  }
  const saveSettings = async () => {
    try {
      const parsed = JSON.parse(settingsText)
      await fetch(apiBase + `/admin/teams/${teamId}/settings`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
      setMessage('Settings saved')
    } catch (e) {
      setMessage('Invalid JSON')
    }
    setTimeout(() => setMessage(''), 2000)
  }
  const archiveProject = async (archive: boolean) => {
    if (!projectId) return
    const path = archive ? 'archive' : 'unarchive'
    await fetch(apiBase + `/admin/projects/${projectId}/${path}`, { method: 'POST', headers })
    setArchivedMsg(archive ? 'Project archived' : 'Project unarchived')
    setTimeout(() => setArchivedMsg(''), 2000)
  }

  const colors = theme === 'dark'
    ? { bg: '#0b1220', fg: '#e5e7eb', card: '#111827', border: '#1f2937', label: '#9ca3af' }
    : { bg: '#f3f4f6', fg: '#111827', card: '#ffffff', border: '#e5e7eb', label: '#6b7280' }
  const cardStyle: React.CSSProperties = { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, boxShadow: theme==='dark'?'none':'0 1px 2px rgba(0,0,0,0.04)' }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: colors.label }
  return (
    <div style={{ padding: 16, background: colors.bg, color: colors.fg }}>
      <h2 style={{ marginBottom: 16 }}>{lang==='zh'?'管理员界面':'Admin'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>团队成员与角色</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="团队ID" value={teamId} onChange={e => setTeamId(e.target.value)} />
              <button onClick={loadMembers}>加载</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {members.map(m => (
              <li key={m.user_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ flex: 1 }}>
                  <div>{m.user_id}</div>
                  <div style={labelStyle}>角色</div>
                </div>
                <select value={m.role} onChange={e => setRole(m.user_id, e.target.value)}>
                  {['staff','lead','manager','supervisor'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </li>
            ))}
            </ul>
          </div>
        </div>
        <div>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>团队设置</h3>
            <div style={labelStyle}>JSON</div>
            <textarea value={settingsText} onChange={e => setSettingsText(e.target.value)} style={{ width: '100%', height: 200 }} />
            <div style={{ marginTop: 8 }}>
              <button onClick={saveSettings}>保存设置</button>
              {message && <span style={{ marginLeft: 8, color: message === 'Invalid JSON' ? 'red' : 'green' }}>{message}</span>}
            </div>
          </div>
        </div>
        <div>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>项目管理</h3>
            <input placeholder="项目ID" value={projectId} onChange={e => setProjectId(e.target.value)} />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => archiveProject(true)}>归档项目</button>
              <button onClick={() => archiveProject(false)}>取消归档</button>
              {archivedMsg && <span style={{ marginLeft: 8, color: 'blue' }}>{archivedMsg}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
