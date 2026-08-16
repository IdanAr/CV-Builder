'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { signOut } from 'next-auth/react'
import Image from 'next/image'

interface UserProfileButtonProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

function Avatar({
  image,
  name,
  size,
}: {
  image?: string | null
  name?: string | null
  size: number
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? 'User'}
        width={size}
        height={size}
        className="rounded-full"
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.floor(size * 0.42) }}
    >
      {getInitials(name)}
    </div>
  )
}

export function UserProfileButton({ user }: UserProfileButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const termsCloseRef = useRef<HTMLButtonElement>(null)

  // Portals render the menu/modals into document.body so they always sit above
  // ancestors (e.g. the navbar's backdrop-blur) which create their own stacking
  // context and containing block for fixed-position elements.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = containerRef.current?.contains(target) ?? false
      const insideMenu = menuRef.current?.contains(target) ?? false
      if (!insideTrigger && !insideMenu) {
        setDropdownOpen(false)
      }
    }
    function getMenuItems(): HTMLElement[] {
      return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = getMenuItems()
        if (items.length === 0) return
        const currentIndex = items.indexOf(document.activeElement as HTMLElement)
        let nextIndex: number
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1
        } else {
          nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
        }
        items[nextIndex]?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dropdownOpen])

  // Stable callback ref (not a plain useEffect keyed on dropdownOpen/menuPosition):
  // menuPosition is recomputed to a new object on every scroll/resize while the
  // menu is open, so an effect depending on it would steal focus back to the
  // first item on every scroll. A callback ref only fires when the underlying
  // DOM node itself is created (menu opens) or torn down (menu closes).
  const setMenuNode = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node
    if (node) {
      node.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [])

  useEffect(() => {
    if (!termsOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setTermsOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [termsOpen])

  useEffect(() => {
    if (termsOpen) {
      termsCloseRef.current?.focus()
      return () => { triggerRef.current?.focus() }
    }
  }, [termsOpen])

  const firstName = user.name?.split(' ')[0] ?? 'Account'

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger pill */}
      <button
        ref={triggerRef}
        onClick={() => setDropdownOpen(o => !o)}
        aria-label="Open user menu"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-indigo-200/40 bg-white/70 px-2.5 py-1 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Avatar image={user.image} name={user.name} size={26} />
        <span className="text-xs font-medium text-indigo-700">{firstName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
          className={`text-indigo-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {mounted && dropdownOpen && menuPosition && createPortal(
        <div
          ref={setMenuNode}
          role="menu"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed z-[100] w-56 overflow-hidden rounded-xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl"
        >
          {/* User info header (non-interactive) */}
          <div className="flex items-center gap-3 border-b border-indigo-50 px-4 py-3">
            <Avatar image={user.image} name={user.name} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-indigo-900">
                {user.name ?? 'User'}
              </p>
              <p className="truncate text-xs text-indigo-400">{user.email ?? ''}</p>
            </div>
          </div>

          {/* Menu items */}
          <div role="group" className="p-1.5">
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setDropdownOpen(false)
                setTermsOpen(true)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-900 transition hover:bg-indigo-50/70"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-indigo-400"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Terms &amp; Conditions
            </button>
          </div>

          {/* Sign Out */}
          <div role="group" className="border-t border-indigo-50 p-1.5">
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => signOut({ callbackUrl: '/signin' })}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50/80"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Terms & Conditions modal */}
      {mounted && termsOpen && createPortal(
        <div
          data-testid="terms-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-900/10 px-4 backdrop-blur-sm"
          onClick={() => setTermsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-white/50 bg-white/90 shadow-2xl backdrop-blur-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-indigo-50 px-6 py-4">
              <h2 id="terms-dialog-title" className="text-base font-bold text-indigo-900">
                Terms &amp; Conditions
              </h2>
              <button
                ref={termsCloseRef}
                aria-label="Close Terms"
                onClick={() => setTermsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50/60 text-sm text-indigo-400 transition hover:bg-indigo-100/80"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5 text-sm">
              <p className="mb-4 text-xs text-indigo-400">Effective date: June 2026</p>

              <h3 className="mb-1 font-semibold text-indigo-900">1. Acceptance of Terms</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                By accessing or using CV Builder, you agree to be bound by these Terms and
                Conditions. If you do not agree, you may not use the service.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">2. Description of Service</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                CV Builder is an AI-assisted platform for creating, editing, and exporting
                professional CVs and résumés. Features include a live editor, AI content
                suggestions, ATS scoring, and export to PDF and DOCX formats.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">3. User Accounts</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                You must authenticate via a supported OAuth provider (Google or GitHub) to use
                the service. You are responsible for all activity that occurs under your
                account. You agree not to share access credentials or use the service for any
                unlawful purpose.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">4. AI-Generated Content</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                CV Builder uses AI models to generate and refine CV content. AI-generated
                suggestions are provided as a starting point only. You are solely responsible
                for reviewing, editing, and verifying the accuracy of all content before
                submitting it to employers or third parties. CV Builder does not guarantee that
                AI-generated content is accurate, complete, or appropriate for your specific
                situation.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">5. Your Content</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                You retain ownership of all CV data and documents you create using the service.
                By using the service, you grant CV Builder a limited licence to store and
                process your data solely for the purpose of providing the service to you. We do
                not sell or share your personal CV data with third parties.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">6. Acceptable Use</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                You agree not to: (a) upload content that is unlawful, harmful, or infringes
                third-party rights; (b) attempt to reverse-engineer, scrape, or disrupt the
                service; (c) use the service to generate false or misleading employment
                credentials.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">7. Intellectual Property</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                The CV Builder application, including its design, code, and branding, is the
                intellectual property of its creators. Nothing in these Terms grants you any
                right to use CV Builder&apos;s trademarks or branding.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">8. Disclaimer of Warranties</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                The service is provided &quot;as is&quot; without warranties of any kind,
                express or implied, including fitness for a particular purpose. We do not
                warrant that the service will be uninterrupted or error-free.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">9. Limitation of Liability</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                To the fullest extent permitted by law, CV Builder and its creators shall not
                be liable for any indirect, incidental, or consequential damages arising from
                your use of the service, including any decisions made by employers or recruiters
                based on CV content generated using this platform.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">10. Changes to These Terms</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                We may update these Terms from time to time. Continued use of the service after
                changes are posted constitutes your acceptance of the revised Terms.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">11. Contact</h3>
              <p className="leading-relaxed text-indigo-700">
                Questions about these Terms may be directed to:{' '}
                <a
                  href="mailto:idan.rbel@gmail.com"
                  className="text-indigo-600 underline"
                >
                  idan.rbel@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
