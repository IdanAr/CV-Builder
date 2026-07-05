'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/stores/toast.store'

interface NewResumeButtonProps {
  variant?: 'navbar' | 'hero'
}

export default function NewResumeButton({ variant = 'navbar' }: NewResumeButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled CV' }),
      })
      if (!res.ok) throw new Error('Failed to create resume')
      const { resume } = await res.json()
      router.push(`/dashboard/resumes/${resume._id}`)
    } catch (err) {
      console.error(err)
      toast.error('Could not create a new CV. Please try again.')
      setLoading(false)
    }
  }

  const className =
    variant === 'hero'
      ? 'w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50'
      : 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50'

  return (
    <button onClick={handleCreate} disabled={loading} className={className}>
      {loading ? 'Creating…' : '+ New CV'}
    </button>
  )
}
