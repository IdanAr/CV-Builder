'use client'

import React from 'react'

interface ListFieldManagerProps<T> {
  items: T[]
  onChange: (items: T[]) => void
  createEmpty: () => T
  renderItem: (item: T, index: number, onUpdate: (v: T) => void, onRemove: () => void) => React.ReactNode
  addLabel?: string
}

export function ListFieldManager<T>({
  items, onChange, createEmpty, renderItem, addLabel = 'Add entry',
}: ListFieldManagerProps<T>) {
  const add = () => onChange([...items, createEmpty()])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, v: T) => onChange(items.map((item, idx) => (idx === i ? v : item)))

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-indigo-100 rounded-lg p-3 bg-white/60 backdrop-blur-sm">
          {renderItem(item, i, (v) => update(i, v), () => remove(i))}
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
        + {addLabel}
      </button>
    </div>
  )
}
