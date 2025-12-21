import React, { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

export function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onClose])

  return (
    <div className={`toast ${toast.type}`} style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <span>{toast.message}</span>
        <button
          onClick={() => onClose(toast.id)}
          style={{
            background: 'transparent',
            color: 'inherit',
            padding: '0.25rem',
            minWidth: 'auto',
            fontSize: '1.25rem',
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1001 }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  )
}
