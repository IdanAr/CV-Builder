'use client'

import { ClipboardList, Copy, Download, MoreVertical, Trash2 } from 'lucide-react'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu'
import { Button } from '@/components/ui/Button'
import type { useResumeActions } from './use-resume-actions'

type ResumeActions = ReturnType<typeof useResumeActions>

/**
 * The trailing overflow menu shared by table rows and cards. It takes the
 * row's already-mounted `useResumeActions` result rather than calling the hook
 * itself, so each CV has exactly one hook instance whichever view renders it.
 * Delete goes to the library (`onDelete`), which owns the undo window.
 */
export function CvRowActions({
  title,
  actions,
  onDelete,
}: {
  title: string
  actions: ResumeActions
  onDelete: () => void
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`More actions for ${title}`}>
          <MoreVertical aria-hidden="true" className="h-4 w-4" />
        </Button>
      </MenuTrigger>
      <MenuContent className="w-48 p-1.5">
        <MenuItem disabled={actions.duplicating} onSelect={() => void actions.duplicate()}>
          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          Duplicate
        </MenuItem>
        <MenuItem disabled={actions.downloading} onSelect={() => void actions.download()}>
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          Download JSON
        </MenuItem>
        <MenuItem disabled={actions.tracking} onSelect={() => void actions.track()}>
          <ClipboardList aria-hidden="true" className="h-3.5 w-3.5" />
          Track application
        </MenuItem>
        <MenuItem
          className="text-fg-danger hover:bg-surface-danger data-[highlighted]:bg-surface-danger"
          onSelect={onDelete}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
