import type { FC } from 'react'

export interface TabItem { id: string; label: string }

export interface TabsProps {
  /** Strings or { id, label } pairs. */
  tabs?: (string | TabItem)[]
  active?: string
  onChange?: (id: string) => void
}

/**
 * Underline tab bar — the editor's Edit / Design / ATS switcher.
 * @startingPoint section="Core" subtitle="Underline tabs" viewport="700x100"
 */
export declare const Tabs: FC<TabsProps>
