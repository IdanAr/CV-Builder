import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  duration: number
  actionLabel?: string
  onAction?: () => void
}

interface ToastStore {
  toasts: Toast[]
  show: (t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (t) => {
    const id = nextId++
    const entry: Toast = { duration: 5000, ...t, id }
    set((s) => ({ toasts: [...s.toasts, entry] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().show({ message, variant: 'success' }),
  error: (message: string) => useToastStore.getState().show({ message, variant: 'error' }),
  info: (message: string) => useToastStore.getState().show({ message, variant: 'info' }),
  withAction: (
    message: string,
    actionLabel: string,
    onAction: () => void,
    duration = 6000
  ) => useToastStore.getState().show({ message, variant: 'info', actionLabel, onAction, duration }),
}
