import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface TaskCreateModalProps {
  projectId: string
  onSave: (task: {
    projectId: string
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    dueDate?: number
    labels?: string[]
    status?: 'todo' | 'in_progress' | 'review' | 'done'
  }) => void
  onClose: () => void
  lang: 'zh' | 'en'
}

export function TaskCreateModal({ projectId, onSave, onClose, lang }: TaskCreateModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState('')
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'review' | 'done'>('todo')
  const [showPreview, setShowPreview] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      labels: labels.split(',').map(l => l.trim()).filter(Boolean),
      status
    })
  }

  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      zh: {
        createTask: '创建新任务',
        title: '标题',
        description: '描述',
        priority: '优先级',
        status: '状态',
        dueDate: '截止日期',
        labels: '标签',
        labelsHint: '用逗号分隔',
        preview: '预览',
        edit: '编辑',
        create: '创建',
        cancel: '取消',
        low: '低',
        medium: '中',
        high: '高',
        urgent: '紧急',
        todo: '待办',
        in_progress: '进行中',
        review: '评审',
        done: '已完成'
      },
      en: {
        createTask: 'Create New Task',
        title: 'Title',
        description: 'Description',
        priority: 'Priority',
        status: 'Status',
        dueDate: 'Due Date',
        labels: 'Labels',
        labelsHint: 'Comma separated',
        preview: 'Preview',
        edit: 'Edit',
        create: 'Create',
        cancel: 'Cancel',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent',
        todo: 'To Do',
        in_progress: 'In Progress',
        review: 'Review',
        done: 'Done'
      }
    }
    return dict[lang][key] || key
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{t('createTask')}</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              {t('title')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              style={{ width: '100%' }}
              placeholder={lang === 'zh' ? '输入任务标题' : 'Enter task title'}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              {t('description')} (Markdown)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{
                  background: !showPreview ? 'var(--primary)' : 'transparent',
                  color: !showPreview ? 'white' : 'var(--text)',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.875rem'
                }}
              >
                {t('edit')}
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                style={{
                  background: showPreview ? 'var(--primary)' : 'transparent',
                  color: showPreview ? 'white' : 'var(--text)',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.875rem'
                }}
              >
                {t('preview')}
              </button>
            </div>
            {!showPreview ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                style={{ width: '100%', fontFamily: 'monospace' }}
                placeholder={lang === 'zh' ? '（可选）添加详细描述' : '(Optional) Add detailed description'}
              />
            ) : (
              <div className="markdown-preview" style={{ minHeight: '150px' }}>
                <ReactMarkdown>{description || '*' + (lang === 'zh' ? '无描述' : 'No description') + '*'}</ReactMarkdown>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                {t('status')}
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ width: '100%' }}>
                <option value="todo">{t('todo')}</option>
                <option value="in_progress">{t('in_progress')}</option>
                <option value="review">{t('review')}</option>
                <option value="done">{t('done')}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                {t('priority')}
              </label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as any)} style={{ width: '100%' }}>
                <option value="low">{t('low')}</option>
                <option value="medium">{t('medium')}</option>
                <option value="high">{t('high')}</option>
                <option value="urgent">{t('urgent')}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                {t('dueDate')}
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              {t('labels')} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#6b7280' }}>({t('labelsHint')})</span>
            </label>
            <input
              type="text"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="feature, bug, ui"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ background: 'transparent', color: 'var(--text)' }}>
              {t('cancel')}
            </button>
            <button type="submit">
              {t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
