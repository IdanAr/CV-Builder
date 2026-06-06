'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewResumeButton() {
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
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? 'Creating…' : '+ New CV'}
    </button>
  )
}
