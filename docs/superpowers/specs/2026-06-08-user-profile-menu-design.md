# User Profile Menu — Design Spec

**Date:** 2026-06-08  
**Status:** Approved

---

## Overview

Add a user profile button to the app's top navbar that triggers a dropdown menu with three items: Settings, Terms & Conditions, and Sign Out.

---

## Architecture

**Approach:** `UserProfileButton` client component threaded via the existing `AppNavbar` `actions` slot.

`AppNavbar` is unchanged. Server pages that render the navbar pass `<UserProfileButton user={session.user} />` as an action. This follows the existing pattern used by `UploadCVButton` and `NewResumeButton`.

`EditorShell` is a client component and cannot call `auth()` internally, so its server page (`ResumePage`) passes `session.user` down as a new `user` prop.

---

## Components

### `UserProfileButton` (`components/ui/UserProfileButton.tsx`)

**Client component.** Owns all interactive state:

- `dropdownOpen: boolean` — toggles the dropdown panel
- `settingsOpen: boolean` — opens Settings modal
- `termsOpen: boolean` — opens T&C modal

**Props:**
```ts
interface UserProfileButtonProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}
```

**Trigger button:** Avatar + name pill, right-aligned in the navbar. Avatar is the user's OAuth profile image if available; falls back to a 2-character uppercase initials string derived from the first letter of each word in `name` (e.g. "Idan Arbel" → "IA"). A chevron icon rotates when the dropdown is open.

**Dropdown panel:** Floats below the trigger, `z-50`, `right-0`. Glassmorphic card (`bg-white/90 backdrop-blur-xl border border-white/40 shadow-xl rounded-xl`). Closes on outside click (`useEffect` + `mousedown` listener on `document`) and on `Escape` key.

Dropdown structure:
1. **User info header** — avatar + full name + email, non-interactive, separated by a divider
2. **Settings** — gear icon, opens `SettingsModal`
3. **Terms & Conditions** — document icon, opens `TermsModal`
4. Divider
5. **Sign Out** — logout icon, red text, calls `signOut({ callbackUrl: '/signin' })` from `next-auth/react`

---

### `SettingsModal` (inlined in `UserProfileButton.tsx`)

Centered modal dialog. Glassmorphic card overlaid on a dimmed backdrop. Content area is a blank placeholder (`Settings content coming soon`) styled with a dashed indigo border. Closed by the ✕ button or clicking the backdrop.

---

### `TermsModal` (inlined in `UserProfileButton.tsx`)

Same modal shell as Settings. Contains the full Terms & Conditions text for CV Builder (see content below). Scrollable body for long content.

---

## File Changes

| File | Change |
|------|--------|
| `components/ui/UserProfileButton.tsx` | **Create** — full component with dropdown + both modals |
| `app/(dashboard)/dashboard/page.tsx` | **Edit** — import and pass `<UserProfileButton user={session.user} />` to AppNavbar actions, positioned after existing buttons (rightmost) |
| `app/(dashboard)/dashboard/resumes/[id]/page.tsx` | **Edit** — pass `session.user` as `user` prop to `EditorShell` |
| `components/editor/EditorShell.tsx` | **Edit** — add `user` prop to `EditorShellProps`, pass `<UserProfileButton user={user} />` to AppNavbar actions |

`AppNavbar.tsx` — no changes.

---

## Sign Out Flow

Calls `signOut({ callbackUrl: '/signin' })` from `next-auth/react`. NextAuth v5 handles session destruction; the `callbackUrl` ensures the user lands on `/signin`. No confirmation dialog — immediate on click, consistent with the minimalist aesthetic.

---

## Visual Design

Matches the existing glassmorphic design language:

- **Trigger pill:** `bg-white/70 border border-indigo-200/40 rounded-full px-2.5 py-1` with indigo gradient avatar circle
- **Dropdown card:** `bg-white/90 backdrop-blur-xl border border-white/40 rounded-xl shadow-xl`
- **Menu items:** `rounded-lg hover:bg-indigo-50/70` with indigo icons (15×15 Lucide-style SVGs)
- **Sign Out item:** red icon + red text, `hover:bg-red-50/80`
- **Modals:** same glassmorphic card style, `max-w-md w-full mx-4`, centered via fixed+flex overlay

---

## Terms & Conditions Content

**Effective date:** June 2026

### 1. Acceptance of Terms
By accessing or using CV Builder, you agree to be bound by these Terms and Conditions. If you do not agree, you may not use the service.

### 2. Description of Service
CV Builder is an AI-assisted platform for creating, editing, and exporting professional CVs and résumés. Features include a live editor, AI content suggestions, ATS scoring, and export to PDF and DOCX formats.

### 3. User Accounts
You must authenticate via a supported OAuth provider (Google or GitHub) to use the service. You are responsible for all activity that occurs under your account. You agree not to share access credentials or use the service for any unlawful purpose.

### 4. AI-Generated Content
CV Builder uses AI models to generate and refine CV content. AI-generated suggestions are provided as a starting point only. You are solely responsible for reviewing, editing, and verifying the accuracy of all content before submitting it to employers or third parties. CV Builder does not guarantee that AI-generated content is accurate, complete, or appropriate for your specific situation.

### 5. Your Content
You retain ownership of all CV data and documents you create using the service. By using the service, you grant CV Builder a limited licence to store and process your data solely for the purpose of providing the service to you. We do not sell or share your personal CV data with third parties.

### 6. Acceptable Use
You agree not to: (a) upload content that is unlawful, harmful, or infringes third-party rights; (b) attempt to reverse-engineer, scrape, or disrupt the service; (c) use the service to generate false or misleading employment credentials.

### 7. Intellectual Property
The CV Builder application, including its design, code, and branding, is the intellectual property of its creators. Nothing in these Terms grants you any right to use CV Builder's trademarks or branding.

### 8. Disclaimer of Warranties
The service is provided "as is" without warranties of any kind, express or implied, including fitness for a particular purpose. We do not warrant that the service will be uninterrupted or error-free.

### 9. Limitation of Liability
To the fullest extent permitted by law, CV Builder and its creators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including any decisions made by employers or recruiters based on CV content generated using this platform.

### 10. Changes to These Terms
We may update these Terms from time to time. Continued use of the service after changes are posted constitutes your acceptance of the revised Terms.

### 11. Contact
Questions about these Terms may be directed to: **idan.rbel@gmail.com**

---

## Out of Scope

- Settings content (blank placeholder — future implementation)
- Account deletion flow
- Email/password authentication
- Notification preferences
