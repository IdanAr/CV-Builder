// components/editor/PreviewEditOverlay.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSectionItems } from '@/lib/editor/section-items'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface EntryRectEntry extends Rect {
  sectionKey: string
  index: number
}

export interface PreviewEditOverlayProps {
  innerRef: React.RefObject<HTMLDivElement | null>
  wrapperRef: React.RefObject<HTMLDivElement | null>
  scale: number
  sectionOrder: string[]
  data: ResumeData
}

function useMeasuredRects(
  innerRef: React.RefObject<HTMLDivElement | null>,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  // Re-measure whenever content, order, or zoom could have moved things —
  // the ResizeObserver alone doesn't catch a reorder that keeps total
  // height constant.
  deps: readonly unknown[]
): { sectionRects: Record<string, Rect>; entryRects: EntryRectEntry[] } {
  const [sectionRects, setSectionRects] = useState<Record<string, Rect>>({})
  const [entryRects, setEntryRects] = useState<EntryRectEntry[]>([])

  const measure = useCallback(() => {
    const inner = innerRef.current
    const wrapper = wrapperRef.current
    if (!inner || !wrapper) return
    const wrapperBox = wrapper.getBoundingClientRect()

    const nextSections: Record<string, Rect> = {}
    inner.querySelectorAll<HTMLElement>('[data-pv-section]').forEach((el) => {
      const key = el.dataset.pvSection
      if (!key) return
      const box = el.getBoundingClientRect()
      nextSections[key] = {
        top: box.top - wrapperBox.top,
        left: box.left - wrapperBox.left,
        width: box.width,
        height: box.height,
      }
    })

    const nextEntries: EntryRectEntry[] = []
    inner.querySelectorAll<HTMLElement>('[data-pv-entry]').forEach((el) => {
      const sectionEl = el.closest<HTMLElement>('[data-pv-section]')
      const sectionKey = sectionEl?.dataset.pvSection
      const idxStr = el.dataset.pvEntry
      if (!sectionKey || idxStr === undefined) return
      const box = el.getBoundingClientRect()
      nextEntries.push({
        sectionKey,
        index: Number(idxStr),
        top: box.top - wrapperBox.top,
        left: box.left - wrapperBox.left,
        width: box.width,
        height: box.height,
      })
    })

    setSectionRects(nextSections)
    setEntryRects(nextEntries)
  }, [innerRef, wrapperRef])

  // useEffect instead of useLayoutEffect: this component is a sibling of
  // wrapperRef's div, not an ancestor. React attaches refs during commit in
  // depth-first order, so when this sibling's useLayoutEffect would fire,
  // wrapperRef.current is still null. useEffect defers measurement until after
  // the entire tree's layout phase is complete, ensuring both refs are set.
  // Consequence: there is one frame of stale or zero handle positions after
  // mount and after each sectionOrder/data/scale change. Consumers (Tasks 10-12
  // drag handles, add/remove controls) should not assume positions are
  // instantaneously current during fast sequences of edits.
  useEffect(() => {
    measure()
    const inner = innerRef.current
    if (!inner) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(inner)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps])

  return { sectionRects, entryRects }
}

export function PreviewEditOverlay({ innerRef, wrapperRef, scale, sectionOrder, data }: PreviewEditOverlayProps) {
  const { sectionRects, entryRects } = useMeasuredRects(innerRef, wrapperRef, [sectionOrder, data, scale])

  return (
    <>
      {sectionOrder.map((sectionKey) => {
        const sectionRect = sectionRects[sectionKey]
        if (!sectionRect) return null
        const items = getSectionItems(data, sectionKey)
        return (
          <div key={sectionKey}>
            <button
              type="button"
              data-testid={`pv-handle-section|${sectionKey}`}
              aria-label={`Drag to reorder section`}
              style={{
                position: 'absolute',
                top: sectionRect.top,
                left: Math.max(sectionRect.left - 24, 0),
                width: 20,
                height: 20,
              }}
            />
            {items.map((_, i) => {
              const entryRect = entryRects.find((r) => r.sectionKey === sectionKey && r.index === i)
              if (!entryRect) return null
              return (
                <button
                  key={i}
                  type="button"
                  data-testid={`pv-handle-entry|${sectionKey}|${i}`}
                  aria-label={`Drag to reorder entry ${i + 1}`}
                  style={{
                    position: 'absolute',
                    top: entryRect.top,
                    left: Math.max(entryRect.left - 20, 0),
                    width: 16,
                    height: 16,
                  }}
                />
              )
            })}
          </div>
        )
      })}
    </>
  )
}
