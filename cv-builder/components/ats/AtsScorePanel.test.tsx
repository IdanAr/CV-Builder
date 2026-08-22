// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AtsScorePanel, sortByPriority } from './AtsScorePanel'
import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'
import type { AtsScoreResult } from '@/lib/ats/scorer'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
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

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

// Every test that needs step-2 or step-3 content reaches it through these —
// centralizing the navigation click keeps each test focused on its own
// assertion instead of repeating the same button lookup everywhere.
async function goToStep2() {
  const nextButton = await screen.findByRole('button', { name: /next: close the gap/i })
  fireEvent.click(nextButton)
}

async function goToStep3() {
  const nextButton = await screen.findByRole('button', { name: /next: review & apply/i })
  await waitFor(() => expect(nextButton).not.toBeDisabled())
  fireEvent.click(nextButton)
}

async function analyzeWith(jobDescriptionText = 'Looking for a React + TypeScript engineer.') {
  fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
    target: { value: jobDescriptionText },
  })
  fireEvent.click(screen.getByText('Analyze'))
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

describe('AtsScorePanel text status label', () => {
  it('shows a text status label alongside a low score, not color alone', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()

    await waitFor(() => expect(screen.getByText(/needs work|poor match/i)).toBeInTheDocument())
  })

  it('shows "Good match" for a high score', async () => {
    const highScore: AtsScoreResult = {
      total: 85,
      breakdown: { format: 25, keywordDensity: 35, keywordPlacement: 20, metrics: 5 },
      matchedKeywords: ['react', 'typescript'],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(highScore))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()

    await waitFor(() => expect(screen.getByText(/good match/i)).toBeInTheDocument())
  })
})

describe('AtsScorePanel help popover for Semantic Match / Tailor with AI', () => {
  it('is closed by default and opens to show both explanations when the "?" button is clicked', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    expect(screen.queryByText(/it doesn.t rewrite anything/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /what do semantic match and tailor with ai do/i }))

    expect(screen.getByText(/it doesn.t rewrite anything/i)).toBeInTheDocument()
    expect(screen.getByText(/you review and approve each suggested change/i)).toBeInTheDocument()
  })

  it('renders the primary action buttons at the theme color and a 44px-tall touch target', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    const semanticButton = screen.getByRole('button', { name: '🔎 Semantic Match' })
    const tailorButton = screen.getByText(/tailor with ai/i).closest('button')
    expect(semanticButton?.className).toContain('bg-indigo-600')
    expect(semanticButton?.className).toContain('min-h-[44px]')
    expect(tailorButton?.className).toContain('bg-indigo-600')
    expect(tailorButton?.className).toContain('min-h-[44px]')
  })
})

describe('AtsScorePanel applyFix for generate-kind summary fixes', () => {
  it('applying a generate fix sets basics.summary when no summary existed before', async () => {
    const fetchMock = vi
      .fn()
      // 1st call: POST /ats-score
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      // 2nd call: POST /ats-fix
      .mockResolvedValueOnce(jsonResponse([generateFix]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/tailor with ai/i))
    await goToStep3()
    await waitFor(() => expect(screen.getByText('Apply')).toBeInTheDocument())

    expect(useResumeEditorStore.getState().data.basics?.summary).toBeUndefined()

    fireEvent.click(screen.getByText('Apply'))

    const { data } = useResumeEditorStore.getState()
    expect(data.basics?.summary).toBe(
      'React and TypeScript engineer focused on ATS-optimized resumes.'
    )
    // Applying the summary must not clobber the rest of basics.
    expect(data.basics?.name).toBe('Jane Doe')
  })
})

describe('AtsScorePanel Apply All Verified', () => {
  it('applies only fixes with no pendingApprovals, leaving flagged ones for individual review', async () => {
    useResumeEditorStore.setState({
      data: { basics: { name: 'Jane Doe' }, work: [{ highlights: ['Built a system.'] }] },
    })
    const workFix: AtsFix = {
      id: 'fix-work',
      section: 'work',
      kind: 'edit',
      workIndex: 0,
      highlightIndex: 0,
      original: 'Built a system.',
      suggested: 'Built a scalable system.',
      targetKeywords: ['react'],
      pendingApprovals: [],
    }
    const flaggedSummaryFix: AtsFix = {
      ...generateFix,
      id: 'fix-summary-flagged',
      suggested: 'Grew revenue by 45%.',
      pendingApprovals: ['45%'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse([workFix, flaggedSummaryFix]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/tailor with ai/i))
    await goToStep3()
    const applyAllButton = await screen.findByRole('button', { name: /apply all verified/i })
    expect(applyAllButton.textContent).toContain('(1)')

    fireEvent.click(applyAllButton)

    const { data } = useResumeEditorStore.getState()
    expect(data.work?.[0].highlights?.[0]).toBe('Built a scalable system.')
    expect(data.basics?.summary).toBeUndefined()
    // The flagged fix is still awaiting individual review, not silently dropped.
    expect(screen.getByText(/not in your original text/i)).toBeInTheDocument()
  })
})

describe('AtsScorePanel applyFix for roles[]-only work entries', () => {
  it('writes the suggested text into work[].roles[] when the fix targets a role, not the legacy field', async () => {
    // Mirrors a work entry edited through the current editor UI, where
    // WorkForm.tsx clears the legacy top-level fields and moves everything
    // into roles[] on save.
    useResumeEditorStore.setState({
      data: {
        basics: { name: 'Jane Doe' },
        work: [{ name: 'Acme Corp', highlights: undefined, roles: [{ id: 'role-1', highlights: ['Built a system.'] }] }],
      },
    })
    const roleFix: AtsFix = {
      id: 'fix-work-0-r0-0',
      section: 'work',
      kind: 'edit',
      workIndex: 0,
      roleIndex: 0,
      highlightIndex: 0,
      original: 'Built a system.',
      suggested: 'Built a scalable system.',
      targetKeywords: ['react'],
      pendingApprovals: [],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse([roleFix]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/tailor with ai/i))
    await goToStep3()
    await waitFor(() => expect(screen.getByText('Apply')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Apply'))

    const { data } = useResumeEditorStore.getState()
    expect(data.work?.[0].roles?.[0].highlights?.[0]).toBe('Built a scalable system.')
    // Must not resurrect the legacy field the current editor already cleared.
    expect(data.work?.[0].highlights).toBeUndefined()
  })
})

describe('AtsScorePanel keyword exclusion toggle', () => {
  it('clicking a missing-keyword chip excludes it, persists via setMeta, and re-analyzes', async () => {
    const afterExclusion: AtsScoreResult = {
      total: 30,
      breakdown: { format: 20, keywordDensity: 0, keywordPlacement: 0, metrics: 5 },
      matchedKeywords: [],
      missingKeywords: ['typescript'],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: ['react'],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse(afterExclusion))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText('react')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Exclude "react" from scoring'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.excludedKeywords).toEqual(['react'])
    // The jdKeywords from the first /ats-score response are re-sent, proving
    // the exclude-toggle re-score reuses the cached AI extraction instead of
    // triggering a fresh one server-side.
    expect(secondCallBody.jdKeywords).toEqual(['react', 'typescript'])
    expect(useResumeEditorStore.getState().meta.excludedAtsKeywords).toEqual(['react'])

    const chip = await screen.findByLabelText('Include "react" in scoring')
    expect(chip.className).toContain('line-through')
  })

  it('clicking an already-excluded chip re-includes it', async () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, excludedAtsKeywords: ['react'] } })
    const preExcluded: AtsScoreResult = {
      total: 30,
      breakdown: { format: 20, keywordDensity: 0, keywordPlacement: 0, metrics: 5 },
      matchedKeywords: [],
      missingKeywords: ['typescript'],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: ['react'],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(preExcluded))
      .mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByLabelText('Include "react" in scoring')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Include "react" in scoring'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.excludedKeywords).toEqual([])
    expect(secondCallBody.jdKeywords).toEqual(['react', 'typescript'])
    expect(useResumeEditorStore.getState().meta.excludedAtsKeywords).toEqual([])
  })
})

describe('AtsScorePanel semantic match', () => {
  it('clicking Semantic Match calls the endpoint, re-analyzes, and styles the confirmed chip distinctly', async () => {
    const afterSemantic: AtsScoreResult = {
      total: 55,
      breakdown: { format: 20, keywordDensity: 35, keywordPlacement: 25, metrics: 5 },
      matchedKeywords: ['react'],
      missingKeywords: ['typescript'],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi
      .fn()
      // 1st call: POST /ats-score (initial Analyze)
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      // 2nd call: POST /ats-semantic-match
      .mockResolvedValueOnce(jsonResponse({ confirmedMatches: ['react'] }))
      // 3rd call: POST /ats-score (re-analyze after semantic match)
      .mockResolvedValueOnce(jsonResponse(afterSemantic))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByRole('button', { name: '🔎 Semantic Match' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '🔎 Semantic Match' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const semanticCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(semanticCallBody.missingKeywords).toEqual(['react', 'typescript'])
    const rescoreCallBody = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(rescoreCallBody.semanticMatches).toEqual(['react'])
    // The re-score after Semantic Match also reuses the cached jdKeywords
    // from the initial Analyze, instead of triggering a fresh AI extraction.
    expect(rescoreCallBody.jdKeywords).toEqual(['react', 'typescript'])

    const reactChip = await screen.findByLabelText('Exclude "react" from scoring')
    await waitFor(() => expect(reactChip.className).toContain('teal'))
    await waitFor(() => expect(screen.queryByText(/semantic match/i)).not.toBeInTheDocument())
  })

  it('shows an error message when the semantic match request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByRole('button', { name: '🔎 Semantic Match' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '🔎 Semantic Match' }))

    const errorMessage = await screen.findByText(/semantic match failed/i)
    expect(errorMessage).toBeInTheDocument()
    // Sits inside the bg-red-50 missing-keywords container, where text-red-600
    // falls just under AA contrast (~4.42:1) — must be red-700 (~5.92:1).
    expect(errorMessage.className).toContain('text-red-700')
    expect(errorMessage.className).not.toContain('text-red-600')
  })

  it('shows a soft nudge to try Semantic Match first, hiding it once Semantic Match has run', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse({ confirmedMatches: [] }))
      .mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    await waitFor(() => expect(screen.getByText(/try semantic match first/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '🔎 Semantic Match' }))

    await waitFor(() => expect(screen.queryByText(/try semantic match first/i)).not.toBeInTheDocument())
  })

  it('does not gate Tailor with AI on having tried Semantic Match — both stay clickable', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/try semantic match first/i)).toBeInTheDocument())

    const tailorButton = screen.getByText(/tailor with ai/i).closest('button')
    expect(tailorButton).not.toBeDisabled()
  })
})

describe('AtsScorePanel fix generation error', () => {
  it('shows an error message when fix generation fails, using AA-safe contrast', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/tailor with ai/i))

    const errorMessage = await screen.findByText(/could not generate fixes/i)
    expect(errorMessage).toBeInTheDocument()
    // Same bg-red-50 container as the semanticError message — text-red-600
    // fails AA there (~4.42:1); must be red-700 (~5.92:1).
    expect(errorMessage.className).toContain('text-red-700')
    expect(errorMessage.className).not.toContain('text-red-600')
  })
})

describe('AtsScorePanel missing-keyword overflow label', () => {
  it('shows a "+N more" label with AA-safe contrast when there are more than 40 missing keywords', async () => {
    const manyMissing: AtsScoreResult = {
      total: 20,
      breakdown: { format: 5, keywordDensity: 5, keywordPlacement: 5, metrics: 5 },
      matchedKeywords: [],
      // 45 missing keywords -> overflow label reads "+5 more" (45 - 40 shown)
      missingKeywords: Array.from({ length: 45 }, (_, i) => `skill-${i}`),
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: [],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(manyMissing))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith('Looking for a candidate with many skills.')
    await goToStep2()

    const overflowLabel = await screen.findByText('+5 more')
    // Sits in the same bg-red-50 container as the other fixed instances —
    // text-red-500 fails AA there (~3.44:1 against #fef2f2); must be red-700 (~5.92:1).
    expect(overflowLabel.className).toContain('text-red-700')
    expect(overflowLabel.className).not.toContain('text-red-500')
  })
})

describe('AtsScorePanel missing-keyword ignore hint', () => {
  it('shows a hint explaining that clicking a missing keyword ignores it everywhere', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    await waitFor(() =>
      expect(screen.getByText(/click a keyword you don't have to ignore it/i)).toBeInTheDocument()
    )
  })

  it('does not show the hint when there are no missing keywords', async () => {
    const noMissing: AtsScoreResult = {
      total: 90,
      breakdown: { format: 25, keywordDensity: 35, keywordPlacement: 25, metrics: 5 },
      matchedKeywords: ['react', 'typescript'],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(noMissing))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    await waitFor(() => expect(screen.getByText(/matched keywords/i)).toBeInTheDocument())
    expect(screen.queryByText(/click a keyword you don't have to ignore it/i)).not.toBeInTheDocument()
  })
})

describe('AtsScorePanel jdKeywords caching', () => {
  it('a fresh Analyze click always sends an empty jdKeywords cache, letting the server extract fresh', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(firstCallBody.jdKeywords).toEqual([])
  })

  it('re-analyzing after editing the job description resets the cache rather than reusing stale keywords', async () => {
    const secondScoreResult: AtsScoreResult = {
      total: 60,
      breakdown: { format: 20, keywordDensity: 20, keywordPlacement: 15, metrics: 5 },
      matchedKeywords: ['mixpanel'],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['mixpanel'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse(secondScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    const textarea = screen.getByPlaceholderText(/paste the full job description/i)
    fireEvent.change(textarea, { target: { value: 'Looking for a React + TypeScript engineer.' } })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.change(textarea, { target: { value: 'Analytics role needing Mixpanel expertise.' } })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.jdKeywords).toEqual([])
  })
})

describe('AtsScorePanel missing-keyword priority coloring', () => {
  const priorityScoreResult = {
    ...scoreResult,
    missingKeywords: ['react', 'typescript', 'agile'],
    keywordPriorities: { react: 'must', typescript: 'nice-to-have' }, // agile intentionally absent
  }

  it('colors a must-have missing keyword red', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    const reactChip = await screen.findByLabelText('Exclude "react" from scoring')
    expect(reactChip.className).toContain('red')
    expect(reactChip.className).not.toContain('yellow')
  })

  it('colors a nice-to-have missing keyword yellow', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    const tsChip = await screen.findByLabelText('Exclude "typescript" from scoring')
    expect(tsChip.className).toContain('yellow')
    expect(tsChip.className).not.toContain('red')
  })

  it('colors a missing keyword with no priority entry (ambiguous) red, same as must-have', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    const agileChip = await screen.findByLabelText('Exclude "agile" from scoring')
    expect(agileChip.className).toContain('red')
    expect(agileChip.className).not.toContain('yellow')
  })

  it('shows a legend explaining the red/yellow priority coloring', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    await waitFor(() => expect(screen.getByText(/nice-to-have/i)).toBeInTheDocument())
    expect(screen.getByText(/must-have/i)).toBeInTheDocument()
  })

  it('orders must-have and ambiguous missing keywords before nice-to-have ones in the chip list', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()

    await screen.findByLabelText('Exclude "react" from scoring')
    const chipTexts = screen.getAllByRole('button', { name: /^(Exclude|Include) "(react|typescript|agile)" (from|in) scoring$/ })
      .map((el) => el.textContent)
    // react (must) and agile (ambiguous, absent priority) both rank before
    // typescript (nice-to-have); react/agile relative order is preserved
    // from the server's missingKeywords array (stable sort).
    expect(chipTexts.indexOf('react')).toBeLessThan(chipTexts.indexOf('typescript'))
    expect(chipTexts.indexOf('agile')).toBeLessThan(chipTexts.indexOf('typescript'))
  })

  it('caches and forwards keywordPriorities on a re-score of the same job description', async () => {
    const afterExclusion = {
      ...priorityScoreResult,
      missingKeywords: ['typescript', 'agile'],
      excludedMissingKeywords: ['react'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(priorityScoreResult))
      .mockResolvedValueOnce(jsonResponse(afterExclusion))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByLabelText('Exclude "react" from scoring')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Exclude "react" from scoring'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.keywordPriorities).toEqual({ react: 'must', typescript: 'nice-to-have' })
  })

  it('a fresh Analyze click sends an empty keywordPriorities cache', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(firstCallBody.keywordPriorities).toEqual({})
  })
})

describe('sortByPriority', () => {
  it('orders must and ambiguous keywords before nice-to-have', () => {
    const result = sortByPriority(
      ['figma', 'kubernetes', 'notion', 'graphql'],
      { kubernetes: 'must', graphql: 'ambiguous', figma: 'nice-to-have', notion: 'nice-to-have' }
    )
    expect(result).toEqual(['kubernetes', 'graphql', 'figma', 'notion'])
  })

  it('treats an absent priority as ambiguous, sorting it before nice-to-have', () => {
    const result = sortByPriority(['react', 'figma'], { figma: 'nice-to-have' })
    expect(result).toEqual(['react', 'figma'])
  })

  it('preserves relative order within the same priority tier (stable sort)', () => {
    const result = sortByPriority(
      ['zeta', 'alpha', 'beta'],
      { zeta: 'must', alpha: 'must', beta: 'must' }
    )
    expect(result).toEqual(['zeta', 'alpha', 'beta'])
  })
})

describe('AtsScorePanel wizard navigation', () => {
  it('starts on step 1 and unlocks step 2 only after a successful Analyze', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    expect(screen.getByRole('tab', { name: /review & apply/i })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /close the gap/i })).toBeDisabled()

    await analyzeWith()

    await waitFor(() => expect(screen.getByRole('tab', { name: /close the gap/i })).not.toBeDisabled())
  })

  it('does not auto-navigate to step 2 after Analyze — the user stays on step 1 until clicking Next', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()

    await waitFor(() => expect(screen.getByText(/score breakdown/i)).toBeInTheDocument())
    expect(screen.queryByText(/missing keywords/i)).not.toBeInTheDocument()
  })

  it('going Back from step 2 to step 1 preserves the score instead of clearing it', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /← back$/i }))

    expect(screen.getByText(/score breakdown/i)).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('clicking an unlocked StepsBar segment jumps directly to that step', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await waitFor(() => expect(screen.getByRole('tab', { name: /close the gap/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('tab', { name: /close the gap/i }))

    expect(screen.getByText(/missing keywords/i)).toBeInTheDocument()
  })

  it('unlocks step 3 directly when the analysis finds zero missing keywords', async () => {
    const noMissing: AtsScoreResult = {
      total: 95,
      breakdown: { format: 25, keywordDensity: 35, keywordPlacement: 25, metrics: 5 },
      matchedKeywords: ['react'],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['react'],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(noMissing))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()

    await waitFor(() => expect(screen.getByRole('tab', { name: /review & apply/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('tab', { name: /review & apply/i }))
    expect(screen.getByText(/nothing to fix/i)).toBeInTheDocument()
  })
})

describe('AtsScorePanel regenerate fixes (dead-end avoidance)', () => {
  it('offers Regenerate once every returned fix has been dismissed', async () => {
    const fixToDismiss: AtsFix = {
      id: 'fix-a',
      section: 'summary',
      kind: 'generate',
      original: '',
      suggested: 'A summary.',
      targetKeywords: ['react'],
      pendingApprovals: [],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse([fixToDismiss]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/tailor with ai/i))
    await goToStep3()

    await waitFor(() => expect(screen.getByText('Dismiss')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Dismiss'))

    await waitFor(() => expect(screen.getByText(/regenerate fixes/i)).toBeInTheDocument())
  })

  it('offers Regenerate immediately when Tailor with AI returns zero fixes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/tailor with ai/i))
    await goToStep3()

    await waitFor(() => expect(screen.getByText(/no specific fixes found/i)).toBeInTheDocument())
    expect(screen.getByText(/regenerate fixes/i)).toBeInTheDocument()
  })

  it('clicking Regenerate calls the fix-generation endpoint again', async () => {
    const fixToDismiss: AtsFix = {
      id: 'fix-a',
      section: 'summary',
      kind: 'generate',
      original: '',
      suggested: 'A summary.',
      targetKeywords: ['react'],
      pendingApprovals: [],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([fixToDismiss]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/tailor with ai/i))
    await goToStep3()
    await waitFor(() => expect(screen.getByText(/regenerate fixes/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/regenerate fixes/i))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.getByText('A summary.')).toBeInTheDocument())
  })
})

describe('AtsScorePanel applied-fix confirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the applied confirmation immediately, then removes the fix after the timeout', async () => {
    const fixToApply: AtsFix = {
      id: 'fix-a',
      section: 'summary',
      kind: 'generate',
      original: '',
      suggested: 'A summary.',
      targetKeywords: ['react'],
      pendingApprovals: [],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse([fixToApply]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    await analyzeWith()
    await goToStep2()
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/tailor with ai/i))
    await goToStep3()
    await waitFor(() => expect(screen.getByText('Apply')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Apply'))

    expect(screen.getByText('✓ Applied')).toBeInTheDocument()
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1300) })

    expect(screen.queryByText('✓ Applied')).not.toBeInTheDocument()
  })
})
