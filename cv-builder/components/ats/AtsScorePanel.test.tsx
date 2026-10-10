// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AtsScorePanel, sortByPriority } from './AtsScorePanel'
import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'
import type { AtsScoreResult } from '@/lib/ats/scorer'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [], fontScale: 1,
}

const scoreResult: AtsScoreResult = {
  total: 42,
  breakdown: { format: 20, keywordDensity: 10, keywordPlacement: 7, metrics: 5 },
  matchedKeywords: [],
  missingKeywords: ['react', 'typescript'],
  excludedMatchedKeywords: [],
  excludedMissingKeywords: [],
  jdKeywords: ['react', 'typescript'],
}

const generateFix: AtsFix = {
  id: 'fix-summary-new',
  section: 'summary',
  kind: 'generate',
  original: '',
  suggested: 'React and TypeScript engineer focused on ATS-optimized resumes.',
  targetKeywords: ['react', 'typescript'],
  pendingApprovals: [],
}

interface Reply { ok?: boolean; status?: number; body: unknown }

/**
 * Routes fetch by URL, so a test states what each endpoint answers rather than
 * the exact order of calls (the panel now saves before scoring and runs the
 * synonym check by itself). Each route replays its replies in order and then
 * repeats the last one. Autosave PATCHes always succeed.
 */
function mockApi(routes: Record<string, Reply[]>) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> | undefined }> = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'PATCH') return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) }
    const key = Object.keys(routes).find((k) => url.endsWith(k))
    if (!key) throw new Error(`unexpected fetch ${url}`)
    const queue = routes[key]
    const r = queue.length > 1 ? queue.shift()! : queue[0]
    return { ok: r.ok ?? true, status: r.status ?? 200, headers: new Headers(), json: async () => r.body }
  })
  vi.stubGlobal('fetch', fn)
  return { fn, to: (k: string) => calls.filter((c) => c.url.endsWith(k)), calls }
}

const NO_SYNONYMS: Reply[] = [{ body: { confirmedMatches: [] } }]

async function check(jobDescriptionText = 'Looking for a React + TypeScript engineer.') {
  fireEvent.change(screen.getByLabelText('Job description'), { target: { value: jobDescriptionText } })
  fireEvent.click(screen.getByRole('button', { name: /check match/i }))
  await screen.findByRole('region', { name: 'ATS score' })
}

async function generate() {
  fireEvent.click(await screen.findByRole('button', { name: /add missing keywords with ai/i }))
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1',
    title: 'CV',
    // No basics.summary — this resume has never had one.
    data: { basics: { name: 'Jane Doe' } },
    meta: defaultMeta,
    isDirty: false,
    isSaving: false,
    saveError: null,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AtsScorePanel: checking a job', () => {
  it('keeps the Check button disabled until a job description is pasted', () => {
    render(<AtsScorePanel />)
    expect(screen.getByRole('button', { name: /check match/i })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: /check match/i })).toBeEnabled()
  })

  it('shows the score with a text verdict, not colour alone, and the four parts of the score', async () => {
    mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS })
    render(<AtsScorePanel />)
    await check()
    const region = screen.getByRole('region', { name: 'ATS score' })
    expect(within(region).getByText('42')).toBeInTheDocument()
    expect(within(region).getByText('Needs work')).toBeInTheDocument()
    for (const label of ['Keyword coverage', 'Structure', 'Keyword placement', 'Measurable results']) {
      expect(within(region).getByText(label)).toBeInTheDocument()
    }
  })

  it('says "Good match" for a high score', async () => {
    mockApi({ '/ats-score': [{ body: { ...scoreResult, total: 85 } }], '/ats-semantic-match': NO_SYNONYMS })
    render(<AtsScorePanel />)
    await check()
    expect(screen.getByText('Good match')).toBeInTheDocument()
  })

  it('folds the job description into a one-line summary, and Change job brings the text back', async () => {
    mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS })
    render(<AtsScorePanel />)
    await check('A job.')
    expect(screen.queryByLabelText('Job description')).toBeNull()
    expect(screen.getByText(/6 characters · 2 keywords found/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change job' }))
    expect(screen.getByLabelText('Job description')).toHaveValue('A job.')
  })

  it('shows the server error and keeps the input open when scoring fails', async () => {
    mockApi({ '/ats-score': [{ ok: false, status: 500, body: { error: 'Scoring is down.' } }] })
    render(<AtsScorePanel />)
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'A job.' } })
    fireEvent.click(screen.getByRole('button', { name: /check match/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Scoring is down.')
    expect(screen.getByLabelText('Job description')).toBeInTheDocument()
  })

  it('saves pending edits before scoring, because the route reads the CV from the database', async () => {
    const api = mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS })
    useResumeEditorStore.setState({ isDirty: true })
    render(<AtsScorePanel />)
    await check()
    const order = api.calls.map((c) => c.method === 'PATCH' ? 'save' : c.url.split('/').pop())
    expect(order.indexOf('save')).toBeLessThan(order.indexOf('ats-score'))
  })

  it('a fresh check always sends empty keyword caches, so the server re-reads the job', async () => {
    const api = mockApi({
      '/ats-score': [{ body: { ...scoreResult, keywordPriorities: { react: 'must' } } }],
      '/ats-semantic-match': NO_SYNONYMS,
    })
    render(<AtsScorePanel />)
    await check('First job')
    fireEvent.click(screen.getByRole('button', { name: 'Change job' }))
    await check('Second job')
    const scoreCalls = api.to('/ats-score')
    expect(scoreCalls.at(-1)?.body?.jobDescription).toBe('Second job')
    expect(scoreCalls.at(-1)?.body?.jdKeywords).toEqual([])
    expect(scoreCalls.at(-1)?.body?.keywordPriorities).toEqual({})
  })
})

describe('AtsScorePanel: automatic synonym check', () => {
  it('runs by itself after the score, re-scores with the confirmed matches, and marks them', async () => {
    const api = mockApi({
      '/ats-score': [
        { body: { ...scoreResult, keywordPriorities: { react: 'must' } } },
        { body: { ...scoreResult, total: 60, matchedKeywords: ['typescript'], missingKeywords: ['react'] } },
      ],
      '/ats-semantic-match': [{ body: { confirmedMatches: ['typescript'] } }],
    })
    render(<AtsScorePanel />)
    await check()
    await screen.findByText(/1 keyword is already covered in other words/i)
    expect(api.to('/ats-semantic-match')[0].body).toEqual({ missingKeywords: ['react', 'typescript'] })
    const rescore = api.to('/ats-score')[1].body!
    expect(rescore.semanticMatches).toEqual(['typescript'])
    // Same job: reuse what the first response extracted instead of paying for it again.
    expect(rescore.jdKeywords).toEqual(['react', 'typescript'])
    expect(rescore.keywordPriorities).toEqual({ react: 'must' })

    fireEvent.click(screen.getByRole('button', { name: /already in your cv/i }))
    expect(screen.getByText('(synonym match)')).toBeInTheDocument()
  })

  it('does not re-score when the check confirms nothing', async () => {
    const api = mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS })
    render(<AtsScorePanel />)
    await check()
    await waitFor(() => expect(api.to('/ats-semantic-match')).toHaveLength(1))
    expect(api.to('/ats-score')).toHaveLength(1)
  })

  it('offers a retry when the check fails, without hiding the score', async () => {
    const api = mockApi({
      '/ats-score': [{ body: scoreResult }],
      '/ats-semantic-match': [{ ok: false, status: 500, body: {} }, { body: { confirmedMatches: [] } }],
    })
    render(<AtsScorePanel />)
    await check()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(api.to('/ats-semantic-match')).toHaveLength(2))
    expect(screen.getByRole('region', { name: 'ATS score' })).toBeInTheDocument()
  })

  it('is skipped entirely when nothing is missing', async () => {
    const api = mockApi({
      '/ats-score': [{ body: { ...scoreResult, total: 90, matchedKeywords: ['react', 'typescript'], missingKeywords: [] } }],
    })
    render(<AtsScorePanel />)
    await check()
    expect(screen.getByText(/covers every keyword/i)).toBeInTheDocument()
    expect(api.to('/ats-semantic-match')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /add missing keywords/i })).toBeNull()
  })
})

describe('AtsScorePanel: missing keywords', () => {
  const priorities = { react: 'nice-to-have', typescript: 'must', graphql: 'ambiguous' }

  it('groups must-have and unclear keywords under Required and the rest under Nice to have', async () => {
    mockApi({
      '/ats-score': [{ body: { ...scoreResult, missingKeywords: ['react', 'typescript', 'graphql', 'go'], keywordPriorities: priorities } }],
      '/ats-semantic-match': NO_SYNONYMS,
    })
    render(<AtsScorePanel />)
    await check()
    const required = screen.getByText('Required').nextElementSibling as HTMLElement
    const nice = screen.getByText('Nice to have').nextElementSibling as HTMLElement
    // `go` has no priority entry: unclear counts as required, never hidden.
    expect(within(required).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ignore "typescript"', 'Ignore "graphql"', 'Ignore "go"',
    ])
    expect(within(nice).getByRole('button', { name: 'Ignore "react"' })).toBeInTheDocument()
  })

  it('explains in words what ignoring does', async () => {
    mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS })
    render(<AtsScorePanel />)
    await check()
    expect(screen.getByText(/stops counting against you and the AI won.t add it/i)).toBeInTheDocument()
  })

  it('ignoring a keyword persists it, re-scores with the cached keywords, and lists it as Ignored', async () => {
    const api = mockApi({
      '/ats-score': [
        { body: { ...scoreResult, keywordPriorities: { react: 'must' } } },
        { body: { ...scoreResult, missingKeywords: ['typescript'], excludedMissingKeywords: ['react'] } },
      ],
      '/ats-semantic-match': NO_SYNONYMS,
    })
    render(<AtsScorePanel />)
    await check()
    await waitFor(() => expect(api.to('/ats-semantic-match')).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Ignore "react"' }))

    expect(useResumeEditorStore.getState().meta.excludedAtsKeywords).toEqual(['react'])
    await screen.findByRole('button', { name: 'Count "react" again' })
    const rescore = api.to('/ats-score')[1].body!
    expect(rescore.excludedKeywords).toEqual(['react'])
    expect(rescore.jdKeywords).toEqual(['react', 'typescript'])
    expect(rescore.keywordPriorities).toEqual({ react: 'must' })
  })

  it('Count again re-includes an ignored keyword', async () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, excludedAtsKeywords: ['react'] } })
    mockApi({
      '/ats-score': [{ body: { ...scoreResult, missingKeywords: ['typescript'], excludedMissingKeywords: ['react'] } }],
      '/ats-semantic-match': NO_SYNONYMS,
    })
    render(<AtsScorePanel />)
    await check()
    fireEvent.click(screen.getByRole('button', { name: 'Count "react" again' }))
    expect(useResumeEditorStore.getState().meta.excludedAtsKeywords).toEqual([])
  })
})

describe('AtsScorePanel: AI suggestions', () => {
  it('applying a generate fix sets basics.summary without clobbering the rest of basics', async () => {
    mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS, '/ats-fix': [{ body: [generateFix] }] })
    render(<AtsScorePanel />)
    await check()
    await generate()
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))
    const { data } = useResumeEditorStore.getState()
    expect(data.basics?.summary).toBe('React and TypeScript engineer focused on ATS-optimized resumes.')
    expect(data.basics?.name).toBe('Jane Doe')
  })

  it('Apply All Verified applies every unflagged fix and leaves flagged ones for review', async () => {
    useResumeEditorStore.setState({
      data: { basics: { name: 'Jane Doe' }, work: [{ highlights: ['Built a system.', 'Wrote docs.'] }] },
    })
    const workFix = (i: number, original: string, suggested: string): AtsFix => ({
      id: `fix-work-${i}`, section: 'work', kind: 'edit', workIndex: 0, highlightIndex: i,
      original, suggested, targetKeywords: ['react'], pendingApprovals: [],
    })
    const flagged: AtsFix = { ...generateFix, id: 'fix-flagged', suggested: 'Grew revenue by 45%.', pendingApprovals: ['45%'] }
    mockApi({
      '/ats-score': [{ body: scoreResult }],
      '/ats-semantic-match': NO_SYNONYMS,
      '/ats-fix': [{ body: [workFix(0, 'Built a system.', 'Built a React system.'), workFix(1, 'Wrote docs.', 'Wrote TypeScript docs.'), flagged] }],
    })
    render(<AtsScorePanel />)
    await check()
    await generate()
    const applyAll = await screen.findByRole('button', { name: /apply all verified/i })
    expect(applyAll.textContent).toContain('(2)')
    fireEvent.click(applyAll)

    const { data } = useResumeEditorStore.getState()
    // Both edits land: each apply builds on the previous one, not on stale data.
    expect(data.work?.[0].highlights).toEqual(['Built a React system.', 'Wrote TypeScript docs.'])
    expect(data.basics?.summary).toBeUndefined()
    expect(screen.getByText(/not in your original text/i)).toBeInTheDocument()
  })

  it('writes into work[].roles[] when the fix targets a role, not the legacy field', async () => {
    useResumeEditorStore.setState({
      data: {
        basics: { name: 'Jane Doe' },
        work: [{ name: 'Acme Corp', highlights: undefined, roles: [{ id: 'role-1', highlights: ['Built a system.'] }] }],
      },
    })
    const roleFix: AtsFix = {
      id: 'fix-work-0-r0-0', section: 'work', kind: 'edit', workIndex: 0, roleIndex: 0, highlightIndex: 0,
      original: 'Built a system.', suggested: 'Built a scalable system.', targetKeywords: ['react'], pendingApprovals: [],
    }
    mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS, '/ats-fix': [{ body: [roleFix] }] })
    render(<AtsScorePanel />)
    await check()
    await generate()
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))
    const { data } = useResumeEditorStore.getState()
    expect(data.work?.[0].roles?.[0].highlights?.[0]).toBe('Built a scalable system.')
    expect(data.work?.[0].highlights).toBeUndefined()
  })

  it('shows the error and keeps the button when generation fails', async () => {
    mockApi({
      '/ats-score': [{ body: scoreResult }],
      '/ats-semantic-match': NO_SYNONYMS,
      '/ats-fix': [{ ok: false, status: 500, body: { error: 'Model unavailable.' } }],
    })
    render(<AtsScorePanel />)
    await check()
    await generate()
    expect(await screen.findByRole('alert')).toHaveTextContent('Model unavailable.')
    expect(screen.getByRole('alert').className).toContain('text-fg-danger')
    expect(screen.getByRole('button', { name: /add missing keywords with ai/i })).toBeInTheDocument()
  })

  it('offers Suggest again when the AI returns no edits', async () => {
    const api = mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS, '/ats-fix': [{ body: [] }] })
    render(<AtsScorePanel />)
    await check()
    await generate()
    fireEvent.click(await screen.findByRole('button', { name: /suggest again/i }))
    await waitFor(() => expect(api.to('/ats-fix')).toHaveLength(2))
  })

  it('offers Suggest again once every suggestion is skipped', async () => {
    mockApi({ '/ats-score': [{ body: scoreResult }], '/ats-semantic-match': NO_SYNONYMS, '/ats-fix': [{ body: [generateFix] }] })
    render(<AtsScorePanel />)
    await check()
    await generate()
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(screen.getByText('All suggestions skipped.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /suggest again/i })).toBeInTheDocument()
  })
})

describe('AtsScorePanel: applied confirmation and re-check', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('confirms an applied edit, then offers a re-check that saves first and reuses the cached keywords', async () => {
    const api = mockApi({
      '/ats-score': [{ body: { ...scoreResult, keywordPriorities: { react: 'must' } } }, { body: { ...scoreResult, total: 71 } }],
      '/ats-semantic-match': NO_SYNONYMS,
      '/ats-fix': [{ body: [generateFix] }],
    })
    render(<AtsScorePanel />)
    await check()
    await generate()
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))
    expect(screen.getByText('Applied')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()

    act(() => { vi.advanceTimersByTime(1300) })
    expect(screen.queryByText('Applied')).toBeNull()
    expect(screen.getByText(/1 edit applied/)).toBeInTheDocument()

    const callsBefore = api.calls.length
    fireEvent.click(screen.getByRole('button', { name: /re-check score/i }))
    await screen.findByText('Good match')
    const after = api.calls.slice(callsBefore)
    expect(after[0].method).toBe('PATCH')
    expect(after[1].url.endsWith('/ats-score')).toBe(true)
    expect(after[1].body?.jdKeywords).toEqual(['react', 'typescript'])
    expect(after[1].body?.keywordPriorities).toEqual({ react: 'must' })
  })
})

describe('sortByPriority', () => {
  it('orders must and ambiguous keywords before nice-to-have', () => {
    expect(sortByPriority(['a', 'b', 'c'], { a: 'nice-to-have', b: 'must', c: 'ambiguous' })).toEqual(['b', 'c', 'a'])
  })

  it('treats an absent priority as ambiguous, sorting it before nice-to-have', () => {
    expect(sortByPriority(['a', 'b'], { a: 'nice-to-have' })).toEqual(['b', 'a'])
  })

  it('preserves relative order within the same priority tier (stable sort)', () => {
    expect(sortByPriority(['x', 'y', 'z', 'w'], { x: 'must', y: 'nice-to-have', z: 'must', w: 'nice-to-have' })).toEqual(['x', 'z', 'y', 'w'])
  })
})
