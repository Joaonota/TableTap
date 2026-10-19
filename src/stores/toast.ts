import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastMessage {
  id: string
  title: string
  message?: string
  type: 'success' | 'danger' | 'warning' | 'info'
  duration?: number
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastMessage[]>([])

  const show = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const duration = toast.duration ?? 4000
    const newToast: ToastMessage = { ...toast, id }
    toasts.value.push(newToast)

    if (duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, duration)
    }
  }

  const success = (title: string, message?: string) => show({ title, message, type: 'success' })
  const error = (title: string, message?: string) => show({ title, message, type: 'danger' })
  const warning = (title: string, message?: string) => show({ title, message, type: 'warning' })
  const info = (title: string, message?: string) => show({ title, message, type: 'info' })

  const dismiss = (id: string) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    show,
    success,
    error,
    warning,
    info,
    dismiss
  }
})
