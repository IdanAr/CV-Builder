import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The design system adds radius and shadow values to Tailwind (tailwind.config.ts).
// Plain twMerge does not know them, so `cn('rounded-chip', 'rounded-full')` kept both
// and the winner depended on CSS emission order. Teach it the custom values.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['control', 'card', 'overlay', 'chip'] }],
      shadow: [{ shadow: ['popover'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
