import { describe, it, expect } from 'vitest'
import { scoreResume, flattenAllText } from '../scorer'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const fullData: ResumeData = {
  basics: {
    name: 'Jane Smith',
    label: 'Senior React Developer',
    email: 'jane@example.com',
    summary: 'Expert TypeScript and React developer with 5 years building REST APIs and Node.js microservices.',
  },
  work: [{
    name: 'Acme Corp',
    position: 'Frontend Engineer',
    startDate: '2020-01',
    highlights: [
      'Built React dashboard used by 500 users, increasing retention by 40%',
      'Reduced API response time by 60% through Node.js optimizations',
      'Led a team of 5 developers across 3 projects',
    ],
  }],
  skills: [{ name: 'TypeScript', keywords: ['React', 'Node.js', 'REST APIs'] }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2016-09', endDate: '2020-06' }],
}

const jd = 'We are looking for a React developer with TypeScript experience building REST APIs and Node.js microservices.'

describe('scoreResume', () => {
  it('returns zero total for empty data and empty job description', () => {
    const result = scoreResume({}, '')
    expect(result.total).toBe(0)
  })

  it('format score is 0 for empty data', () => {
    const result = scoreResume({}, jd)
    expect(result.breakdown.format).toBe(0)
  })

  it('format score is 0 for name without email (core identity needs both)', () => {
    const result = scoreResume({ basics: { name: 'Alice' } }, '')
    expect(result.breakdown.format).toBe(0)
  })

  it('format score is 5 for name + email (core identity check only)', () => {
    const result = scoreResume({ basics: { name: 'Alice', email: 'alice@test.com' } }, '')
    expect(result.breakdown.format).toBe(5)
  })

  it('summary just under 40 chars earns no summary points; at 40 it earns 5', () => {
    // 39 chars: identity (5) + summary (0) = 5
    const short = scoreResume(
      { basics: { name: 'Alice', email: 'a@b.co', summary: 'x'.repeat(39) } }, '')
    expect(short.breakdown.format).toBe(5)
    // 40 chars: identity (5) + summary (5) = 10
    const ok = scoreResume(
      { basics: { name: 'Alice', email: 'a@b.co', summary: 'x'.repeat(40) } }, '')
    expect(ok.breakdown.format).toBe(10)
  })

  it('work completeness is proportional: 1 of 2 entries with startDate scores round(5 * 1/2) = 3', () => {
    const data: ResumeData = {
      basics: { name: 'Alice', email: 'a@b.co' },
      work: [
        { name: 'Acme', position: 'Engineer', startDate: '2021-01' },
        { name: 'Beta', position: 'Analyst' },
      ],
    }
    // identity 5 + summary 0 + work 3 + highlights 0 + skills 0 = 8
    const result = scoreResume(data, '')
    expect(result.breakdown.format).toBe(8)
  })

  it('work completeness counts a roles[]-only entry too, not just the legacy flat fields', () => {
    const data: ResumeData = {
      basics: { name: 'Alice', email: 'a@b.co' },
      work: [
        { name: 'Acme', roles: [{ id: 'r1', position: 'Engineer', startDate: '2021-01' }] },
        { name: 'Beta', position: 'Analyst' },
      ],
    }
    // identity 5 + summary 0 + work 3 (Acme complete via roles[], Beta incomplete — no startDate) + highlights 0 + skills 0 = 8
    const result = scoreResume(data, '')
    expect(result.breakdown.format).toBe(8)
  })

  it('paragraph-dump highlights are penalized: 2 of 3 valid bullets scores round(5 * 2/3) = 3', () => {
    const data: ResumeData = {
      basics: { name: 'Alice', email: 'a@b.co' },
      work: [{
        name: 'Acme',
        position: 'Engineer',
        startDate: '2021-01',
        highlights: [
          'Shipped the reporting dashboard feature',
          'A'.repeat(600),
          'Mentored two junior engineers on testing',
        ],
      }],
    }
    // identity 5 + summary 0 + work 5 + highlights 3 + skills 0 = 13
    const result = scoreResume(data, '')
    expect(result.breakdown.format).toBe(13)
  })

  it('bare skill labels are penalized: 1 of 2 skills with keywords scores round(5 * 1/2) = 3', () => {
    const data: ResumeData = {
      basics: { name: 'Alice', email: 'a@b.co' },
      skills: [
        { name: 'Frontend', keywords: ['React'] },
        { name: 'Backend' },
      ],
    }
    // identity 5 + summary 0 + work 0 + highlights 0 + skills 3 = 8
    const result = scoreResume(data, '')
    expect(result.breakdown.format).toBe(8)
  })

  it('format score is 25 for data with all required fields and highlights', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.format).toBe(25)
  })

  it('keyword density and placement are 0 when no job description provided', () => {
    const result = scoreResume(fullData, '')
    expect(result.breakdown.keywordDensity).toBe(0)
    expect(result.breakdown.keywordPlacement).toBe(0)
  })

  it('keyword density score is > 0 when resume contains JD keywords', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.keywordDensity).toBeGreaterThan(0)
  })

  it('keyword placement score is > 0 when high-value sections contain JD keywords', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.keywordPlacement).toBeGreaterThan(0)
  })

  it('metrics score is 0 when no highlights exist', () => {
    const result = scoreResume({ basics: { name: 'Joe' } }, jd)
    expect(result.breakdown.metrics).toBe(0)
  })

  it('metrics score is > 0 when highlights contain numbers', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.metrics).toBeGreaterThan(0)
  })

  it('total equals sum of breakdown values capped at 100', () => {
    const result = scoreResume(fullData, jd)
    const sum = result.breakdown.format + result.breakdown.keywordDensity +
      result.breakdown.keywordPlacement + result.breakdown.metrics
    expect(result.total).toBe(Math.min(100, sum))
  })

  it('missing keywords listed when JD keywords absent from resume', () => {
    const result = scoreResume({ basics: { name: 'Joe' } }, 'Kubernetes Docker AWS experience required')
    expect(result.missingKeywords.length).toBeGreaterThan(0)
  })

  it('matched keywords listed when JD keywords present in resume', () => {
    const result = scoreResume(fullData, 'React TypeScript Node.js developer needed')
    expect(result.matchedKeywords).toContain('react')
  })

  it('total never exceeds 100', () => {
    const result = scoreResume(fullData, jd)
    expect(result.total).toBeLessThanOrEqual(100)
  })

  it('placement score counts keywords found in the second most recent job', () => {
    const data = {
      basics: { name: 'A', email: 'a@b.c' },
      work: [
        { name: 'Acme', position: 'Manager', highlights: ['Led roadmap planning'] },
        { name: 'Beta', position: 'Engineer', highlights: ['Built kubernetes clusters'] },
      ],
    } as ResumeData
    const result = scoreResume(data, 'kubernetes engineer')
    expect(result.breakdown.keywordPlacement).toBeGreaterThan(0)
  })

  it('placement score ignores jobs older than the two most recent', () => {
    const data = {
      basics: { name: 'A', email: 'a@b.c' },
      work: [
        { name: 'Acme', position: 'Manager', highlights: ['Led roadmap planning'] },
        { name: 'Beta', position: 'Analyst', highlights: ['Wrote reports'] },
        { name: 'Gamma', position: 'Engineer', highlights: ['Built kubernetes clusters'] },
      ],
    } as ResumeData
    const result = scoreResume(data, 'kubernetes engineer')
    expect(result.breakdown.keywordPlacement).toBe(0)
  })

  it('excludedMatchedKeywords and excludedMissingKeywords are empty when no exclusions are given', () => {
    const result = scoreResume(fullData, jd)
    expect(result.excludedMatchedKeywords).toEqual([])
    expect(result.excludedMissingKeywords).toEqual([])
  })
})

describe('scoreResume — excludedKeywords', () => {
  it('excluding a matched keyword moves it out of matchedKeywords and can lower keywordDensity when the remaining active keywords are unmatched', () => {
    const data: ResumeData = {
      basics: { name: 'A', email: 'a@b.c' },
      skills: [{ name: 'Stack', keywords: ['React'] }],
    }
    const jdText = 'React Kubernetes developer needed'

    const before = scoreResume(data, jdText)
    expect(before.matchedKeywords).toContain('react')
    expect(before.missingKeywords).toContain('kubernetes')
    expect(before.breakdown.keywordDensity).toBeGreaterThan(0)

    const after = scoreResume(data, jdText, ['react'])
    expect(after.matchedKeywords).not.toContain('react')
    expect(after.excludedMatchedKeywords).toContain('react')
    expect(after.missingKeywords).toContain('kubernetes')
    // Only 1 active keyword remains (kubernetes) and it's unmatched -> density 0
    expect(after.breakdown.keywordDensity).toBe(0)
  })

  it('excluding a missing keyword moves it out of missingKeywords and stops it dragging down keywordDensity', () => {
    const data: ResumeData = {
      basics: { name: 'A', email: 'a@b.c' },
      skills: [{ name: 'Stack', keywords: ['React'] }],
    }
    const jdText = 'React Kubernetes developer needed'

    const before = scoreResume(data, jdText)
    expect(before.breakdown.keywordDensity).toBeLessThan(35)

    const after = scoreResume(data, jdText, ['kubernetes'])
    expect(after.missingKeywords).not.toContain('kubernetes')
    expect(after.excludedMissingKeywords).toContain('kubernetes')
    expect(after.matchedKeywords).toContain('react')
    // Only 1 active keyword remains (react) and it's fully matched -> full 35
    expect(after.breakdown.keywordDensity).toBe(35)
  })

  it('excluded keyword matching is case-insensitive', () => {
    const result = scoreResume({ basics: { name: 'A', email: 'a@b.c' } }, 'Kubernetes required', ['KUBERNETES'])
    expect(result.missingKeywords).not.toContain('kubernetes')
    expect(result.excludedMissingKeywords).toContain('kubernetes')
  })

  it('empty job description still returns empty excluded-keyword arrays', () => {
    const result = scoreResume({}, '', ['react'])
    expect(result.excludedMatchedKeywords).toEqual([])
    expect(result.excludedMissingKeywords).toEqual([])
  })

  it('omitting excludedKeywords entirely reproduces the same result as an empty array', () => {
    const withDefault = scoreResume(fullData, jd)
    const withEmpty = scoreResume(fullData, jd, [])
    expect(withDefault).toEqual(withEmpty)
  })
})

describe('scoreResume — semanticMatches', () => {
  it('promotes a semantically-confirmed keyword from missing to matched', () => {
    const data: ResumeData = {
      basics: { name: 'A', email: 'a@b.c' },
      skills: [{ name: 'Stack', keywords: ['React'] }],
    }
    const jdText = 'React Kubernetes developer needed'

    const before = scoreResume(data, jdText)
    expect(before.missingKeywords).toContain('kubernetes')

    const after = scoreResume(data, jdText, [], ['kubernetes'])
    expect(after.missingKeywords).not.toContain('kubernetes')
    expect(after.matchedKeywords).toContain('kubernetes')
  })

  it('semantic promotion raises keywordDensity to full credit when it is the only unmatched keyword', () => {
    const data: ResumeData = {
      basics: { name: 'A', email: 'a@b.c' },
      skills: [{ name: 'Stack', keywords: ['React'] }],
    }
    const jdText = 'React Kubernetes developer needed'

    const withoutSemantic = scoreResume(data, jdText)
    expect(withoutSemantic.breakdown.keywordDensity).toBeLessThan(35)

    const withSemantic = scoreResume(data, jdText, [], ['kubernetes'])
    expect(withSemantic.breakdown.keywordDensity).toBe(35)
  })

  it('semantic promotion increases keywordPlacement credit', () => {
    const data: ResumeData = {
      basics: { name: 'A', email: 'a@b.c' },
      skills: [{ name: 'Stack', keywords: ['React'] }],
    }
    const jdText = 'React Kubernetes developer needed'

    const withoutSemantic = scoreResume(data, jdText)
    const withSemantic = scoreResume(data, jdText, [], ['kubernetes'])
    expect(withSemantic.breakdown.keywordPlacement).toBeGreaterThan(withoutSemantic.breakdown.keywordPlacement)
  })

  it('semantic match is case-insensitive', () => {
    const data: ResumeData = { basics: { name: 'A', email: 'a@b.c' } }
    const result = scoreResume(data, 'Kubernetes required', [], ['KUBERNETES'])
    expect(result.matchedKeywords).toContain('kubernetes')
  })

  it('an excluded keyword stays excluded even when also semantically confirmed', () => {
    const data: ResumeData = { basics: { name: 'A', email: 'a@b.c' } }
    const result = scoreResume(data, 'Kubernetes required', ['kubernetes'], ['kubernetes'])
    expect(result.matchedKeywords).not.toContain('kubernetes')
    expect(result.missingKeywords).not.toContain('kubernetes')
    expect(result.excludedMatchedKeywords).toContain('kubernetes')
  })

  it('a semantic match for a keyword already literally matched has no effect', () => {
    const withoutSemantic = scoreResume(fullData, jd)
    const withSemantic = scoreResume(fullData, jd, [], ['react'])
    expect(withSemantic).toEqual(withoutSemantic)
  })

  it('omitting semanticMatches entirely reproduces the same result as an empty array', () => {
    const withDefault = scoreResume(fullData, jd)
    const withEmpty = scoreResume(fullData, jd, [], [])
    expect(withDefault).toEqual(withEmpty)
  })
})

describe('scoreResume — jdKeywordsOverride', () => {
  it('returns the regex-extracted keywords in jdKeywords when no override is given', () => {
    const result = scoreResume(fullData, jd)
    expect(result.jdKeywords).toEqual(expect.arrayContaining(['react', 'typescript']))
  })

  it('uses jdKeywordsOverride instead of regex-extracting from the job description', () => {
    const data: ResumeData = {
      basics: { name: 'A', email: 'a@b.c', summary: 'Experienced with Mixpanel and Amplitude analytics.' },
    }
    // The job description text itself contains none of these words, proving
    // the override — not the text — drove extraction.
    const result = scoreResume(data, 'Completely unrelated filler text.', [], [], ['mixpanel', 'amplitude'])
    expect(result.jdKeywords).toEqual(['mixpanel', 'amplitude'])
    expect(result.matchedKeywords).toEqual(expect.arrayContaining(['mixpanel', 'amplitude']))
  })

  it('reflects the override verbatim in the jdKeywords field', () => {
    const result = scoreResume({}, 'irrelevant', [], [], ['jira', 'confluence'])
    expect(result.jdKeywords).toEqual(['jira', 'confluence'])
  })

  it('lowercases jdKeywordsOverride defensively', () => {
    const data: ResumeData = { basics: { name: 'A', email: 'a@b.c', summary: 'Uses Mixpanel daily.' } }
    const result = scoreResume(data, 'irrelevant', [], [], ['Mixpanel'])
    expect(result.jdKeywords).toEqual(['mixpanel'])
    expect(result.matchedKeywords).toContain('mixpanel')
  })

  it('matches multi-word override keywords against resume text', () => {
    const data: ResumeData = {
      basics: { name: 'A', email: 'a@b.c', summary: 'Deployed workloads on Google Cloud Platform.' },
    }
    const result = scoreResume(data, 'irrelevant', [], [], ['google cloud platform'])
    expect(result.matchedKeywords).toContain('google cloud platform')
  })

  it('falls back to regex extraction when jdKeywordsOverride is an empty array', () => {
    const withEmptyOverride = scoreResume(fullData, jd, [], [], [])
    const withoutOverride = scoreResume(fullData, jd)
    expect(withEmptyOverride).toEqual(withoutOverride)
  })

  it('empty-jobDescription short-circuit still includes an empty jdKeywords field', () => {
    const result = scoreResume({}, '')
    expect(result.jdKeywords).toEqual([])
  })
})

describe('nested roles', () => {
  it('flattenAllText includes a second role\'s position, summary, and highlights', () => {
    const data: ResumeData = {
      work: [{
        name: 'Meta', position: 'Data Analyst', highlights: [],
        roles: [{ id: 'r1', position: 'Data Team Lead', summary: 'Led the team.', highlights: ['Grew headcount 3x'] }],
      }],
    }
    const text = flattenAllText(data)
    expect(text).toContain('Data Team Lead')
    expect(text).toContain('Led the team.')
    expect(text).toContain('Grew headcount 3x')
  })

  it('scoreResume matches a JD keyword that only appears in a second role\'s highlights', () => {
    const data: ResumeData = {
      basics: { name: 'Jane', email: 'jane@example.com' },
      work: [{
        name: 'Meta', position: 'Data Analyst', startDate: '2019', highlights: ['Built dashboards'],
        roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021', highlights: ['Led Snowflake migration'] }],
      }],
    }
    const result = scoreResume(data, 'Looking for someone with Snowflake experience')
    expect(result.matchedKeywords).toContain('snowflake')
  })
})
