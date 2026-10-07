'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from '@/lib/stores/toast.store'
import { Button } from '@/components/ui/Button'

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

  return (
    <Button
      onClick={handleCreate}
      disabled={loading}
      size="md"
      className={variant === 'hero' ? 'w-full' : undefined}
      aria-label={loading ? 'Creating…' : 'New CV'}
    >
      {loading ? (
        'Creating…'
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New CV
        </span>
      )}
    </Button>
  )
}
