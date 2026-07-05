import { describe, it, expect, beforeEach } from 'vitest'
import { useToastStore, toast } from './toast.store'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('toast store', () => {
  it('adds a success toast with default duration', () => {
    const id = toast.success('Saved')
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ id, message: 'Saved', variant: 'success', duration: 5000 })
  })

  it('adds an error toast', () => {
    toast.error('Failed')
    expect(useToastStore.getState().toasts[0].variant).toBe('error')
  })

  it('dismiss removes only the targeted toast', () => {
    const a = toast.info('A')
    const b = toast.info('B')
    useToastStore.getState().dismiss(a)
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].id).toBe(b)
  })

  it('withAction stores the action label and callback with custom duration', () => {
    let called = false
    toast.withAction('Deleted "My CV"', 'Undo', () => { called = true }, 6000)
    const t = useToastStore.getState().toasts[0]
    expect(t.actionLabel).toBe('Undo')
    expect(t.duration).toBe(6000)
    t.onAction!()
    expect(called).toBe(true)
  })

  it('assigns unique incrementing ids', () => {
    const a = toast.info('A')
    const b = toast.info('B')
    expect(b).not.toBe(a)
  })
})
