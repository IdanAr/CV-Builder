# CV Builder Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js 14 foundation for the CV Builder — project scaffold, Zod data schemas, MongoDB/Mongoose data layer, Auth.js v5 authentication, REST CRUD API, and dashboard UI with CV cards.

**Architecture:** App Router with REST route handlers under `app/api/resumes/`. Business logic lives in `lib/api/resumes.ts` — plain async functions that can be called by both route handlers and Server Components directly. Auth.js v5 wraps route handlers via `auth()` HOC and protects pages/routes via `middleware.ts`. Two MongoDB connections coexist: a native `MongoClient` (for Auth.js adapter) and a Mongoose connection (for the Resume model).

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, MongoDB Atlas, Mongoose, Zod, Auth.js v5 (`next-auth@5`), `@auth/mongodb-adapter`, Vitest

---

## File Map

| File | Purpose |
|---|---|
| `lib/schemas/resume.zod.ts` | Zod schemas for JSON Resume v1.0.0 + meta. Source of all TS types. |
| `lib/schemas/__tests__/resume.zod.test.ts` | Unit tests for schema validation |
| `lib/sections.ts` | `sectionsFilledCount(data)` utility |
| `lib/__tests__/sections.test.ts` | Unit tests for sectionsFilledCount |
| `lib/db.ts` | Mongoose singleton connection for the Resume model |
| `lib/mongodb.ts` | Native MongoClient singleton for Auth.js adapter |
| `lib/auth.ts` | Auth.js v5 config — exports `handlers`, `auth`, `signIn`, `signOut` |
| `lib/api/resumes.ts` | Business logic: list, get, create, patch, delete, duplicate |
| `lib/api/__tests__/resumes.test.ts` | Unit tests for resume business logic (mocked Mongoose) |
| `models/Resume.ts` | Mongoose model derived from Zod types |
| `types/next-auth.d.ts` | Extends `Session` to include `user.id` |
| `middleware.ts` | Re-exports `auth` to protect `/dashboard/*` and `/api/resumes/*` |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js handler — GET + POST |
| `app/api/resumes/route.ts` | GET list + POST create |
| `app/api/resumes/[id]/route.ts` | GET one + PATCH update + DELETE |
| `app/api/resumes/[id]/duplicate/route.ts` | POST duplicate |
| `app/layout.tsx` | Root layout with Tailwind globals |
| `app/page.tsx` | Redirects `/` → `/dashboard` |
| `app/(auth)/signin/page.tsx` | Sign-in page with Google + GitHub buttons |
| `app/(dashboard)/layout.tsx` | Dashboard shell layout |
| `app/(dashboard)/dashboard/page.tsx` | Server Component — fetches and renders CV list |
| `app/(dashboard)/dashboard/resumes/[id]/page.tsx` | Placeholder page |
| `components/ResumeCard.tsx` | Client Component — CV card with actions |
| `components/NewResumeButton.tsx` | Client Component — creates a new CV |
| `vitest.config.ts` | Vitest config with `@` path alias |
| `.env.local.example` | Environment variable template |

---

## Task 1: Scaffold the project

**Files:** `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `.env.local.example`

- [ ] **Step 1: Create Next.js app**

```bash
npx create-next-app@14 cv-builder --typescript --tailwind --eslint --app --no-src-dir --import-alias="@/*" --no-git
cd cv-builder
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install next-auth@5 @auth/mongodb-adapter mongodb mongoose zod
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 5: Create vitest.setup.ts**

```typescript
// vitest.setup.ts
import { vi } from 'vitest'
// Global test setup — extend as needed
```

- [ ] **Step 6: Add test script to package.json**

Open `package.json` and add to `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 7: Create .env.local.example**

```bash
# .env.local.example
# Copy to .env.local and fill in values

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

# Auth.js
AUTH_SECRET=run-openssl-rand-base64-32-and-paste-here

# GitHub OAuth — create at https://github.com/settings/applications/new
# Homepage URL: http://localhost:3000
# Callback URL: http://localhost:3000/api/auth/callback/github
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Google OAuth — create at https://console.cloud.google.com/
# Authorized redirect URI: http://localhost:3000/api/auth/callback/google
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

- [ ] **Step 8: Copy to .env.local and add it to .gitignore**

```bash
cp .env.local.example .env.local
echo ".env.local" >> .gitignore
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:3000` with no errors.

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js 14 project with Vitest"
```

---

## Task 2: Zod schemas

**Files:**
- Create: `lib/schemas/resume.zod.ts`
- Create: `lib/schemas/__tests__/resume.zod.test.ts`

- [ ] **Step 1: Create the test file**

```bash
mkdir -p lib/schemas/__tests__
```

```typescript
// lib/schemas/__tests__/resume.zod.test.ts
import { describe, it, expect } from 'vitest'
import {
  CreateResumeSchema,
  PatchResumeSchema,
  ResumeMetaSchema,
  ResumeDataSchema,
} from '../resume.zod'

describe('ResumeDataSchema', () => {
  it('accepts an empty object', () => {
    expect(ResumeDataSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a valid basics block', () => {
    const result = ResumeDataSchema.safeParse({
      basics: { name: 'Ada Lovelace', email: 'ada@example.com' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed email in basics', () => {
    const result = ResumeDataSchema.safeParse({
      basics: { email: 'not-an-email' },
    })
    expect(result.success).toBe(false)
  })

  it('accepts work array with highlights', () => {
    const result = ResumeDataSchema.safeParse({
      work: [{ name: 'Acme', position: 'Engineer', highlights: ['Built X', 'Shipped Y'] }],
    })
    expect(result.success).toBe(true)
  })
})

describe('ResumeMetaSchema', () => {
  it('applies all defaults when given empty object', () => {
    const result = ResumeMetaSchema.parse({})
    expect(result.templateId).toBe('classic')
    expect(result.fontFamily).toBe('Calibri')
    expect(result.headerFontFamily).toBe('Calibri')
    expect(result.primaryColor).toBe('#000000')
    expect(result.pageMargins).toBe(1.0)
    expect(result.lineSpacing).toBe(1.15)
    expect(result.layout).toBe('single-column')
  })

  it('rejects pageMargins below 0.5', () => {
    const result = ResumeMetaSchema.safeParse({ pageMargins: 0.4 })
    expect(result.success).toBe(false)
  })

  it('rejects pageMargins above 1.5', () => {
    const result = ResumeMetaSchema.safeParse({ pageMargins: 2.0 })
    expect(result.success).toBe(false)
  })

  it('rejects lineSpacing outside 1.0–1.15', () => {
    expect(ResumeMetaSchema.safeParse({ lineSpacing: 0.9 }).success).toBe(false)
    expect(ResumeMetaSchema.safeParse({ lineSpacing: 1.5 }).success).toBe(false)
  })

  it('rejects unknown layout value', () => {
    const result = ResumeMetaSchema.safeParse({ layout: 'three-column' })
    expect(result.success).toBe(false)
  })
})

describe('CreateResumeSchema', () => {
  it('requires a non-empty title', () => {
    expect(CreateResumeSchema.safeParse({ title: '' }).success).toBe(false)
    expect(CreateResumeSchema.safeParse({ title: 'My CV' }).success).toBe(true)
  })

  it('defaults data and meta when not provided', () => {
    const result = CreateResumeSchema.parse({ title: 'My CV' })
    expect(result.data).toEqual({})
    expect(result.meta.templateId).toBe('classic')
  })
})

describe('PatchResumeSchema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    expect(PatchResumeSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial meta', () => {
    const result = PatchResumeSchema.safeParse({ meta: { fontFamily: 'Arial' } })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.meta?.fontFamily).toBe('Arial')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm run test:run -- lib/schemas/__tests__/resume.zod.test.ts
```

Expected: All tests fail with `Cannot find module '../resume.zod'`.

- [ ] **Step 3: Create lib/schemas/resume.zod.ts**

```typescript
// lib/schemas/resume.zod.ts
import { z } from 'zod'

const LocationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
})

const ProfileSchema = z.object({
  network: z.string().optional(),
  username: z.string().optional(),
  url: z.string().url().optional(),
})

const BasicsSchema = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  image: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  url: z.string().url().optional(),
  summary: z.string().optional(),
  location: LocationSchema.optional(),
  profiles: z.array(ProfileSchema).optional(),
})

const WorkSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  position: z.string().optional(),
  url: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})

const EducationSchema = z.object({
  institution: z.string().optional(),
  url: z.string().url().optional(),
  area: z.string().optional(),
  studyType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
})

const SkillSchema = z.object({
  name: z.string().optional(),
  level: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const CertificateSchema = z.object({
  name: z.string().optional(),
  date: z.string().optional(),
  issuer: z.string().optional(),
  url: z.string().url().optional(),
})

const AwardSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  awarder: z.string().optional(),
  summary: z.string().optional(),
})

const PublicationSchema = z.object({
  name: z.string().optional(),
  publisher: z.string().optional(),
  releaseDate: z.string().optional(),
  url: z.string().url().optional(),
  summary: z.string().optional(),
})

const VolunteerSchema = z.object({
  organization: z.string().optional(),
  position: z.string().optional(),
  url: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})

const LanguageSchema = z.object({
  language: z.string().optional(),
  fluency: z.string().optional(),
})

const InterestSchema = z.object({
  name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const ProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  url: z.string().url().optional(),
  roles: z.array(z.string()).optional(),
  entity: z.string().optional(),
  type: z.string().optional(),
})

export const ResumeDataSchema = z.object({
  basics: BasicsSchema.optional(),
  work: z.array(WorkSchema).optional(),
  education: z.array(EducationSchema).optional(),
  skills: z.array(SkillSchema).optional(),
  certificates: z.array(CertificateSchema).optional(),
  awards: z.array(AwardSchema).optional(),
  publications: z.array(PublicationSchema).optional(),
  volunteer: z.array(VolunteerSchema).optional(),
  languages: z.array(LanguageSchema).optional(),
  interests: z.array(InterestSchema).optional(),
  projects: z.array(ProjectSchema).optional(),
})

export const ResumeMetaSchema = z.object({
  templateId: z.string().default('classic'),
  fontFamily: z.string().default('Calibri'),
  headerFontFamily: z.string().default('Calibri'),
  primaryColor: z.string().default('#000000'),
  accentColor: z.string().default('#0066cc'),
  pageMargins: z.number().min(0.5).max(1.5).default(1.0),
  lineSpacing: z.number().min(1.0).max(1.15).default(1.15),
  sectionOrder: z
    .array(z.string())
    .default(['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']),
  layout: z.enum(['single-column', 'two-column']).default('single-column'),
})

export const CreateResumeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  data: ResumeDataSchema.optional().default({}),
  meta: ResumeMetaSchema.optional().default({}),
})

export const PatchResumeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: ResumeDataSchema.optional(),
  meta: ResumeMetaSchema.partial().optional(),
})

export type ResumeData = z.infer<typeof ResumeDataSchema>
export type ResumeMeta = z.infer<typeof ResumeMetaSchema>
export type CreateResumeInput = z.infer<typeof CreateResumeSchema>
export type PatchResumeInput = z.infer<typeof PatchResumeSchema>
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm run test:run -- lib/schemas/__tests__/resume.zod.test.ts
```

Expected: All 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/
git commit -m "feat: add Zod schemas for JSON Resume v1.0.0 and meta"
```

---

## Task 3: sectionsFilledCount utility

**Files:**
- Create: `lib/sections.ts`
- Create: `lib/__tests__/sections.test.ts`

- [ ] **Step 1: Create the test file**

```bash
mkdir -p lib/__tests__
```

```typescript
// lib/__tests__/sections.test.ts
import { describe, it, expect } from 'vitest'
import { sectionsFilledCount } from '../sections'

describe('sectionsFilledCount', () => {
  it('returns 0 for empty data', () => {
    expect(sectionsFilledCount({})).toBe(0)
  })

  it('returns 0 when all sections are empty arrays', () => {
    expect(sectionsFilledCount({ work: [], education: [], skills: [] })).toBe(0)
  })

  it('counts sections with at least one item', () => {
    expect(sectionsFilledCount({
      work: [{ name: 'Acme' }],
      education: [{ institution: 'MIT' }],
      skills: [],
    })).toBe(2)
  })

  it('counts all 10 countable sections', () => {
    expect(sectionsFilledCount({
      work: [{}],
      education: [{}],
      skills: [{}],
      certificates: [{}],
      awards: [{}],
      publications: [{}],
      volunteer: [{}],
      languages: [{}],
      interests: [{}],
      projects: [{}],
    })).toBe(10)
  })

  it('ignores the basics object (not a countable section)', () => {
    expect(sectionsFilledCount({ basics: { name: 'Ada' } })).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:run -- lib/__tests__/sections.test.ts
```

Expected: All tests fail with `Cannot find module '../sections'`.

- [ ] **Step 3: Implement lib/sections.ts**

```typescript
// lib/sections.ts
import type { ResumeData } from './schemas/resume.zod'

const COUNTABLE_SECTIONS = [
  'work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects',
] as const

type CountableSection = typeof COUNTABLE_SECTIONS[number]

export function sectionsFilledCount(data: ResumeData): number {
  return COUNTABLE_SECTIONS.filter((section: CountableSection) => {
    const val = data[section]
    return Array.isArray(val) && val.length > 0
  }).length
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm run test:run -- lib/__tests__/sections.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sections.ts lib/__tests__/sections.test.ts
git commit -m "feat: add sectionsFilledCount utility"
```

---

## Task 4: MongoDB connections

**Files:**
- Create: `lib/db.ts`
- Create: `lib/mongodb.ts`

- [ ] **Step 1: Create lib/db.ts (Mongoose connection singleton)**

```typescript
// lib/db.ts
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: MongooseCache | undefined
}

const cached: MongooseCache = global.__mongoose ?? { conn: null, promise: null }
global.__mongoose = cached

export default async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false })
  }

  cached.conn = await cached.promise
  return cached.conn
}
```

- [ ] **Step 2: Create lib/mongodb.ts (native MongoClient for Auth.js adapter)**

```typescript
// lib/mongodb.ts
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI!

if (!uri) {
  throw new Error('MONGODB_URI environment variable is not defined')
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  if (!global.__mongoClientPromise) {
    const client = new MongoClient(uri)
    global.__mongoClientPromise = client.connect()
  }
  clientPromise = global.__mongoClientPromise
} else {
  const client = new MongoClient(uri)
  clientPromise = client.connect()
}

export default clientPromise
```

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts lib/mongodb.ts
git commit -m "feat: add Mongoose and MongoClient connection singletons"
```

---

## Task 5: Mongoose Resume model

**Files:**
- Create: `models/Resume.ts`

- [ ] **Step 1: Create models/Resume.ts**

```typescript
// models/Resume.ts
import mongoose, { Schema, model, models, type Document } from 'mongoose'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export interface IResume extends Document {
  userId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  createdAt: Date
  updatedAt: Date
}

const ResumeSchema = new Schema<IResume>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    data: { type: Schema.Types.Mixed, default: {} },
    meta: {
      templateId: { type: String, default: 'classic' },
      fontFamily: { type: String, default: 'Calibri' },
      headerFontFamily: { type: String, default: 'Calibri' },
      primaryColor: { type: String, default: '#000000' },
      accentColor: { type: String, default: '#0066cc' },
      pageMargins: { type: Number, default: 1.0 },
      lineSpacing: { type: Number, default: 1.15 },
      sectionOrder: {
        type: [String],
        default: ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects'],
      },
      layout: { type: String, enum: ['single-column', 'two-column'], default: 'single-column' },
    },
  },
  { timestamps: true }
)

const Resume = models.Resume ?? model<IResume>('Resume', ResumeSchema)
export default Resume
```

- [ ] **Step 2: Commit**

```bash
git add models/Resume.ts
git commit -m "feat: add Mongoose Resume model"
```

---

## Task 6: Auth.js v5 configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create types/next-auth.d.ts to extend session with user.id**

```bash
mkdir -p types
```

```typescript
// types/next-auth.d.ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
```

- [ ] **Step 2: Create lib/auth.ts**

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import { MongoDBAdapter } from '@auth/mongodb-adapter'
import clientPromise from './mongodb'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

- [ ] **Step 3: Create app/api/auth/[...nextauth]/route.ts**

```bash
mkdir -p app/api/auth/\[...nextauth\]
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts app/api/auth/
git commit -m "feat: configure Auth.js v5 with Google and GitHub OAuth"
```

---

## Task 7: Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts**

```typescript
// middleware.ts
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: ['/dashboard/:path*', '/api/resumes/:path*'],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware protecting dashboard and API routes"
```

---

## Task 8: Resume business logic

**Files:**
- Create: `lib/api/resumes.ts`
- Create: `lib/api/__tests__/resumes.test.ts`

- [ ] **Step 1: Create the test file**

```bash
mkdir -p lib/api/__tests__
```

```typescript
// lib/api/__tests__/resumes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db connection
vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

// Mock Resume model
const mockSort = vi.fn()
const mockLean = vi.fn()
const mockFind = vi.fn(() => ({ sort: mockSort }))
const mockFindOne = vi.fn()
const mockCreate = vi.fn()
const mockFindOneAndUpdate = vi.fn()
const mockDeleteOne = vi.fn()

vi.mock('@/models/Resume', () => ({
  default: {
    find: mockFind,
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
    deleteOne: mockDeleteOne,
  },
}))

import { listResumes, getResume, createResume, patchResume, deleteResume, duplicateResume } from '../resumes'

beforeEach(() => vi.clearAllMocks())

describe('listResumes', () => {
  it('queries by userId and returns resumes with sectionsFilledCount', async () => {
    const fakeResumes = [
      {
        _id: 'r1',
        userId: 'u1',
        title: 'My CV',
        data: { work: [{ name: 'Acme' }], education: [{ institution: 'MIT' }] },
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')

    expect(mockFind).toHaveBeenCalledWith({ userId: 'u1' })
    expect(result).toHaveLength(1)
    expect(result[0].sectionsFilledCount).toBe(2)
  })
})

describe('getResume', () => {
  it('queries by _id and userId', async () => {
    const fakeResume = { _id: 'r1', userId: 'u1', title: 'My CV', data: {}, meta: {} }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(fakeResume) })

    const result = await getResume('u1', 'r1')

    expect(mockFindOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
    expect(result).toEqual(fakeResume)
  })

  it('returns null when not found', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const result = await getResume('u1', 'nonexistent')
    expect(result).toBeNull()
  })
})

describe('createResume', () => {
  it('creates resume with userId and input', async () => {
    const input = { title: 'New CV', data: {}, meta: { templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri', primaryColor: '#000000', accentColor: '#0066cc', pageMargins: 1.0, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column' as const } }
    const created = { _id: 'r2', userId: 'u1', ...input }
    mockCreate.mockResolvedValue({ toObject: () => created })

    const result = await createResume('u1', input)

    expect(mockCreate).toHaveBeenCalledWith({ userId: 'u1', ...input })
    expect(result).toEqual(created)
  })
})

describe('patchResume', () => {
  it('uses $set with dot-notation for meta fields', async () => {
    const updated = { _id: 'r1', title: 'My CV', meta: { fontFamily: 'Arial' } }
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(updated) })

    await patchResume('u1', 'r1', { meta: { fontFamily: 'Arial' } })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'r1', userId: 'u1' },
      { $set: { 'meta.fontFamily': 'Arial' } },
      { new: true }
    )
  })

  it('sets data directly (full replacement) when provided', async () => {
    const newData = { work: [{ name: 'NewCo' }] }
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) })

    await patchResume('u1', 'r1', { data: newData })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'r1', userId: 'u1' },
      { $set: { data: newData } },
      { new: true }
    )
  })
})

describe('deleteResume', () => {
  it('returns true when a document was deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 })
    const result = await deleteResume('u1', 'r1')
    expect(result).toBe(true)
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
  })

  it('returns false when nothing was deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 0 })
    const result = await deleteResume('u1', 'r1')
    expect(result).toBe(false)
  })
})

describe('duplicateResume', () => {
  it('creates a copy with "Copy of" prefix in title', async () => {
    const source = { _id: 'r1', userId: 'u1', title: 'My CV', data: { work: [] }, meta: {}, createdAt: new Date(), updatedAt: new Date(), __v: 0 }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(source) })
    const copy = { _id: 'r2', userId: 'u1', title: 'Copy of My CV', data: source.data, meta: source.meta }
    mockCreate.mockResolvedValue({ toObject: () => copy })

    const result = await duplicateResume('u1', 'r1')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Copy of My CV', userId: 'u1' })
    )
    expect(result).toEqual(copy)
  })

  it('returns null when source resume not found', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const result = await duplicateResume('u1', 'nonexistent')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:run -- lib/api/__tests__/resumes.test.ts
```

Expected: All tests fail with `Cannot find module '../resumes'`.

- [ ] **Step 3: Implement lib/api/resumes.ts**

```typescript
// lib/api/resumes.ts
import dbConnect from '@/lib/db'
import Resume from '@/models/Resume'
import { sectionsFilledCount } from '@/lib/sections'
import type { CreateResumeInput, PatchResumeInput, ResumeData } from '@/lib/schemas/resume.zod'

export async function listResumes(userId: string) {
  await dbConnect()
  const resumes = await Resume.find({ userId }).sort({ updatedAt: -1 }).lean()
  return resumes.map((r) => ({
    ...r,
    sectionsFilledCount: sectionsFilledCount((r.data ?? {}) as ResumeData),
  }))
}

export async function getResume(userId: string, id: string) {
  await dbConnect()
  return Resume.findOne({ _id: id, userId }).lean()
}

export async function createResume(userId: string, input: CreateResumeInput) {
  await dbConnect()
  const resume = await Resume.create({ userId, ...input })
  return resume.toObject()
}

export async function patchResume(userId: string, id: string, patch: PatchResumeInput) {
  await dbConnect()

  const setPayload: Record<string, unknown> = {}

  if (patch.title !== undefined) setPayload.title = patch.title
  if (patch.data !== undefined) setPayload.data = patch.data
  if (patch.meta !== undefined) {
    for (const [key, value] of Object.entries(patch.meta)) {
      if (value !== undefined) setPayload[`meta.${key}`] = value
    }
  }

  return Resume.findOneAndUpdate(
    { _id: id, userId },
    { $set: setPayload },
    { new: true }
  ).lean()
}

export async function deleteResume(userId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await Resume.deleteOne({ _id: id, userId })
  return result.deletedCount > 0
}

export async function duplicateResume(userId: string, id: string) {
  await dbConnect()
  const source = await Resume.findOne({ _id: id, userId }).lean()
  if (!source) return null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, updatedAt, __v, ...rest } = source as typeof source & { __v?: number }
  const copy = await Resume.create({
    ...rest,
    userId,
    title: `Copy of ${rest.title}`,
  })
  return copy.toObject()
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm run test:run -- lib/api/__tests__/resumes.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/api/
git commit -m "feat: add resume business logic with full test coverage"
```

---

## Task 9: API route — list + create

**Files:**
- Create: `app/api/resumes/route.ts`

- [ ] **Step 1: Create app/api/resumes/route.ts**

```bash
mkdir -p app/api/resumes
```

```typescript
// app/api/resumes/route.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { CreateResumeSchema } from '@/lib/schemas/resume.zod'
import { listResumes, createResume } from '@/lib/api/resumes'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const resumes = await listResumes(req.auth.user.id)
    return NextResponse.json({ resumes })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const result = CreateResumeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: result.error.issues },
        { status: 400 }
      )
    }
    const resume = await createResume(req.auth.user.id, result.data)
    return NextResponse.json({ resume }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add app/api/resumes/route.ts
git commit -m "feat: add GET /api/resumes and POST /api/resumes route handlers"
```

---

## Task 10: API route — get, patch, delete

**Files:**
- Create: `app/api/resumes/[id]/route.ts`

- [ ] **Step 1: Create app/api/resumes/[id]/route.ts**

```bash
mkdir -p "app/api/resumes/[id]"
```

```typescript
// app/api/resumes/[id]/route.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PatchResumeSchema } from '@/lib/schemas/resume.zod'
import { getResume, patchResume, deleteResume } from '@/lib/api/resumes'

export const GET = auth(async function GET(req, { params }: { params: { id: string } }) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const resume = await getResume(req.auth.user.id, params.id)
    if (!resume) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ resume })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})

export const PATCH = auth(async function PATCH(req, { params }: { params: { id: string } }) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const result = PatchResumeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: result.error.issues },
        { status: 400 }
      )
    }
    const resume = await patchResume(req.auth.user.id, params.id, result.data)
    if (!resume) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ resume })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})

export const DELETE = auth(async function DELETE(req, { params }: { params: { id: string } }) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const deleted = await deleteResume(req.auth.user.id, params.id)
    if (!deleted) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/resumes/[id]/route.ts"
git commit -m "feat: add GET, PATCH, DELETE /api/resumes/[id] route handlers"
```

---

## Task 11: API route — duplicate

**Files:**
- Create: `app/api/resumes/[id]/duplicate/route.ts`

- [ ] **Step 1: Create app/api/resumes/[id]/duplicate/route.ts**

```bash
mkdir -p "app/api/resumes/[id]/duplicate"
```

```typescript
// app/api/resumes/[id]/duplicate/route.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { duplicateResume } from '@/lib/api/resumes'

export const POST = auth(async function POST(req, { params }: { params: { id: string } }) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const resume = await duplicateResume(req.auth.user.id, params.id)
    if (!resume) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ resume }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/resumes/[id]/duplicate/route.ts"
git commit -m "feat: add POST /api/resumes/[id]/duplicate route handler"
```

---

## Task 12: Root layout + page redirect

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update app/layout.tsx**

Replace the contents of `app/layout.tsx` with:

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CV Builder',
  description: 'AI-powered CV builder with ATS optimization',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update app/page.tsx to redirect to /dashboard**

Replace the contents of `app/page.tsx` with:

```tsx
// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: root layout and redirect / to /dashboard"
```

---

## Task 13: Sign-in page

**Files:**
- Create: `app/(auth)/signin/page.tsx`

- [ ] **Step 1: Create the sign-in page**

```bash
mkdir -p "app/(auth)/signin"
```

```tsx
// app/(auth)/signin/page.tsx
import { signIn } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-gray-900">
          CV Builder
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">Sign in to continue</p>

        <div className="flex flex-col gap-3">
          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/dashboard' })
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <form
            action={async () => {
              'use server'
              await signIn('github', { redirectTo: '/dashboard' })
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700"
            >
              <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              Continue with GitHub
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(auth)/"
git commit -m "feat: add sign-in page with Google and GitHub OAuth buttons"
```

---

## Task 14: Dashboard components

**Files:**
- Create: `components/NewResumeButton.tsx`
- Create: `components/ResumeCard.tsx`

- [ ] **Step 1: Create components/NewResumeButton.tsx**

```bash
mkdir -p components
```

```tsx
// components/NewResumeButton.tsx
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
      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700 disabled:opacity-50"
    >
      {loading ? 'Creating…' : '+ New CV'}
    </button>
  )
}
```

- [ ] **Step 2: Create components/ResumeCard.tsx**

```tsx
// components/ResumeCard.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ResumeCardProps {
  resume: {
    _id: string
    title: string
    data: {
      basics?: { label?: string }
    }
    meta: {
      templateId?: string
      layout?: string
    }
    sectionsFilledCount: number
    createdAt: string
    updatedAt: string
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 7) return formatDate(iso)
  if (days > 1) return `${days} days ago`
  if (days === 1) return 'Yesterday'
  if (hours > 1) return `${hours} hours ago`
  if (hours === 1) return '1 hour ago'
  if (minutes > 1) return `${minutes} minutes ago`
  return 'Just now'
}

export default function ResumeCard({ resume }: ResumeCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${resume.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/resumes/${resume._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch (err) {
      console.error(err)
      setDeleting(false)
    }
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/resumes/${resume._id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Duplicate failed')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(`/api/resumes/${resume._id}`)
      if (!res.ok) throw new Error('Fetch failed')
      const { resume: full } = await res.json()
      const blob = new Blob([JSON.stringify(full.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resume.title}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{resume.title}</p>
          <p className="truncate text-sm text-gray-500">
            {resume.data.basics?.label ?? 'No role set'} · {resume.meta.templateId ?? 'classic'} template
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/dashboard/resumes/${resume._id}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Open
          </Link>
          <button
            onClick={handleDownload}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            title="Download as JSON"
          >
            ↓ JSON
          </button>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            title="Duplicate"
          >
            {duplicating ? '…' : '⧉'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            title="Delete"
          >
            {deleting ? '…' : '✕'}
          </button>
        </div>
      </div>

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap gap-6 border-t border-gray-100 pt-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Created</p>
          <p className="mt-0.5 text-sm text-gray-700">{formatDate(resume.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Last Edited</p>
          <p className="mt-0.5 text-sm text-gray-700">{formatRelativeTime(resume.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Sections</p>
          <p className="mt-0.5 text-sm text-gray-700">{resume.sectionsFilledCount} filled</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Layout</p>
          <p className="mt-0.5 text-sm capitalize text-gray-700">
            {(resume.meta.layout ?? 'single-column').replace('-', ' ')}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">ATS Score</p>
          <p className="mt-0.5 text-sm italic text-gray-400">— (Phase 3)</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/
git commit -m "feat: add NewResumeButton and ResumeCard client components"
```

---

## Task 15: Dashboard page

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create app/(dashboard)/layout.tsx**

```bash
mkdir -p "app/(dashboard)"
```

```tsx
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white px-6 py-3">
        <span className="text-lg font-bold tracking-tight text-gray-900">CV Builder</span>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create app/(dashboard)/dashboard/page.tsx**

```bash
mkdir -p "app/(dashboard)/dashboard"
```

```tsx
// app/(dashboard)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import ResumeCard from '@/components/ResumeCard'
import NewResumeButton from '@/components/NewResumeButton'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const resumes = await listResumes(session.user.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My CVs</h1>
        <NewResumeButton />
      </div>

      {resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">No CVs yet.</p>
          <p className="mt-1 text-sm text-gray-400">Click &quot;+ New CV&quot; to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {resumes.map((resume) => (
            <ResumeCard
              key={String(resume._id)}
              resume={{
                _id: String(resume._id),
                title: resume.title,
                data: resume.data as { basics?: { label?: string } },
                meta: resume.meta as { templateId?: string; layout?: string },
                sectionsFilledCount: resume.sectionsFilledCount,
                createdAt: resume.createdAt.toISOString(),
                updatedAt: resume.updatedAt.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/"
git commit -m "feat: add dashboard page with CV list and metadata cards"
```

---

## Task 16: Resume placeholder page

**Files:**
- Create: `app/(dashboard)/dashboard/resumes/[id]/page.tsx`

- [ ] **Step 1: Create the placeholder page**

```bash
mkdir -p "app/(dashboard)/dashboard/resumes/[id]"
```

```tsx
// app/(dashboard)/dashboard/resumes/[id]/page.tsx
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { redirect, notFound } from 'next/navigation'

export default async function ResumePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const resume = await getResume(session.user.id, params.id)
  if (!resume) notFound()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold text-gray-900">{resume.title}</h1>
      <p className="mt-2 text-sm text-gray-500">
        The full editor is coming in Phase 2.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        ← Back to dashboard
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/dashboard/resumes/"
git commit -m "feat: add resume placeholder page for Phase 2 editor"
```

---

## Task 17: Full test run + smoke test

- [ ] **Step 1: Run the full test suite**

```bash
npm run test:run
```

Expected: All tests pass (Zod schema tests, sectionsFilledCount tests, resume business logic tests).

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Start dev server and smoke test auth**

```bash
npm run dev
```

Open `http://localhost:3000` — should redirect to `/dashboard`, then to `/signin` (since no session).
Click "Continue with Google" — should initiate OAuth flow (requires `.env.local` populated).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 complete — foundation, auth, API, and dashboard UI"
```
