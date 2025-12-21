import React from 'react'
import type { DraggableProvided } from 'react-beautiful-dnd'

export interface Task {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  key: string
  description?: string
  project_id?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: number
  assignee_id?: string
  labels?: string[]
}

interface TaskCardProps {
  task: Task
  provided: DraggableProvided
  onComment: (taskId: string) => void
  onEdit: (task: Task) => void
  onDelete?: (taskId: string) => void
  lang: 'zh' | 'en'
}

export function TaskCard({ task, provided, onComment, onEdit, onDelete, lang }: TaskCardProps) {
  const priorityColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    urgent: '#dc2626'
  }

  const isOverdue = task.due_date && task.due_date < Date.now() && task.status !== 'done'
  const isDueSoon = task.due_date && task.due_date > Date.now() && task.due_date < Date.now() + 24 * 60 * 60 * 1000 && task.status !== 'done'

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className="task-card"
      style={{
        ...provided.draggableProps.style,
        borderLeft: task.priority ? `3px solid ${priorityColors[task.priority]}` : undefined
      }}
    >
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{task.key}</span>
        {task.priority && (
          <span
            className={`badge badge-priority-${task.priority}`}
            style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}
          >
            {task.priority}
          </span>
        )}
      </div>
      
      <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{task.title}</div>
      
      {task.labels && task.labels.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {task.labels.map((label, idx) => (
            <span key={idx} className="badge" style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>
              {label}
            </span>
          ))}
        </div>
      )}
      
      {task.due_date && (
        <div
          style={{
            fontSize: '0.75rem',
            marginBottom: '0.5rem',
            color: isOverdue ? '#ef4444' : isDueSoon ? '#f59e0b' : '#6b7280'
          }}
        >
          {isOverdue && '⚠️ '}
          {isDueSoon && '⏰ '}
          {lang === 'zh' ? '截止' : 'Due'}: {new Date(task.due_date).toLocaleDateString()}
        </div>
      )}
      
      {task.description && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginBottom: '0.5rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {task.description.slice(0, 80)}
          {task.description.length > 80 && '...'}
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          onClick={(e) => {
            e.stopPropagation()
            onComment(task.id)
          }}
        >
          {lang === 'zh' ? '💬 评论' : '💬 Comment'}
        </button>
        <button
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(task)
          }}
        >
          {lang === 'zh' ? '✏️ 编辑' : '✏️ Edit'}
        </button>
        {onDelete && (
          <button
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#ef4444' }}
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(lang === 'zh' ? '确定删除这个任务吗？' : 'Delete this task?')) {
                onDelete(task.id)
              }
            }}
          >
            {lang === 'zh' ? '🗑️ 删除' : '🗑️ Delete'}
          </button>
        )}
      </div>
    </div>
  )
}
