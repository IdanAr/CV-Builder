'use client'

import type { ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface CollapsibleProps {
  open: boolean
  children: ReactNode
}

/** Animated mount/unmount wrapper: slides open/closed with a height+opacity
 *  transition. Content is unmounted when closed (matches the previous
 *  `{isOpen && ...}` conditional-render behavior exactly). */
export function Collapsible({ open, children }: CollapsibleProps) {
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
