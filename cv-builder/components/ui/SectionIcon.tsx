'use client'

import type { LucideIcon } from 'lucide-react'
import {
  User, Briefcase, GraduationCap, Wrench, Languages, HandHeart,
  BadgeCheck, Award, BookOpen, Sparkles, FolderKanban, Puzzle,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  basics: User,
  work: Briefcase,
  education: GraduationCap,
  skills: Wrench,
  languages: Languages,
  volunteer: HandHeart,
  certificates: BadgeCheck,
  awards: Award,
  publications: BookOpen,
  interests: Sparkles,
  projects: FolderKanban,
}

/** Icon for a section key; custom sections (`custom:*`) and unknown keys
 *  fall back to a puzzle piece. */
export function SectionIcon({ section, className }: { section: string; className?: string }) {
  const Icon = ICONS[section] ?? Puzzle
  return <Icon aria-hidden="true" className={className ?? 'h-4 w-4'} strokeWidth={1.75} />
}
