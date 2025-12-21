import React, { useState } from 'react'

interface ProjectModalProps {
  onSave: (name: string, description: string, color: string) => void
  onClose: () => void
  lang: 'zh' | 'en'
}

export function ProjectModal({ onSave, onClose, lang }: ProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#7c3aed')

  const colors = [
    '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316'
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSave(name.trim(), description.trim(), color)
    }
  }

  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      zh: {
        createProject: '创建新项目',
        projectName: '项目名称',
        projectDescription: '项目描述',
        projectColor: '项目颜色',
        create: '创建',
        cancel: '取消'
      },
      en: {
        createProject: 'Create New Project',
        projectName: 'Project Name',
        projectDescription: 'Project Description',
        projectColor: 'Project Color',
        create: 'Create',
        cancel: 'Cancel'
      }
    }
    return dict[lang][key] || key
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{t('createProject')}</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              {t('projectName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              style={{ width: '100%' }}
              placeholder={lang === 'zh' ? '输入项目名称' : 'Enter project name'}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              {t('projectDescription')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%' }}
              placeholder={lang === 'zh' ? '（可选）项目描述' : '(Optional) Project description'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              {t('projectColor')}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.5rem',
                    background: c,
                    border: color === c ? '3px solid var(--text)' : '2px solid transparent',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ background: 'transparent', color: 'var(--text)' }}>
              {t('cancel')}
            </button>
            <button type="submit" style={{ background: color }}>
              {t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
