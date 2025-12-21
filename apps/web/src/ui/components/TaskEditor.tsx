import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Task } from './TaskCard'

interface TaskEditorProps {
  task: Task | null
  onSave: (updates: Partial<Task>) => void
  onClose: () => void
  lang: 'zh' | 'en'
}

export function TaskEditor({ task, onSave, onClose, lang }: TaskEditorProps) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [priority, setPriority] = useState<Task['priority']>(task?.priority || 'medium')
  const [dueDate, setDueDate] = useState(
    task?.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''
  )
  const [labels, setLabels] = useState(task?.labels?.join(', ') || '')
  const [showPreview, setShowPreview] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const updates: Partial<Task> = {
      title: title.trim(),
      description: description.trim(),
      priority,
      due_date: dueDate ? new Date(dueDate).getTime() : undefined,
      labels: labels.split(',').map(l => l.trim()).filter(Boolean)
    }
    onSave(updates)
  }

  if (!task) return null

  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      zh: {
        editTask: '编辑任务',
        title: '标题',
        description: '描述',
        priority: '优先级',
        dueDate: '截止日期',
        labels: '标签',
        labelsHint: '用逗号分隔',
        preview: '预览',
        edit: '编辑',
        save: '保存',
        cancel: '取消',
        low: '低',
        medium: '中',
        high: '高',
        urgent: '紧急'
      },
      en: {
        editTask: 'Edit Task',
        title: 'Title',
        description: 'Description',
        priority: 'Priority',
        dueDate: 'Due Date',
        labels: 'Labels',
        labelsHint: 'Comma separated',
        preview: 'Preview',
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent'
      }
    }
    return dict[lang][key] || key
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{t('editTask')}</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              {t('title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: '100%' }}
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
                rows={8}
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            ) : (
              <div className="markdown-preview" style={{ minHeight: '200px' }}>
                <ReactMarkdown>{description || '*' + (lang === 'zh' ? '无描述' : 'No description') + '*'}</ReactMarkdown>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                {t('priority')}
              </label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])} style={{ width: '100%' }}>
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
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
