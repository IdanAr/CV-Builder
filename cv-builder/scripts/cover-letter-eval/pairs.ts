// scripts/cover-letter-eval/pairs.ts
// The evaluation set for cover letter quality: CVs paired with real scraped
// postings from the ScrapedJob collection. Only keys and ids live here;
// `eval.ts fixtures` snapshots the actual text into the git-ignored output
// directory so a run stays reproducible after a posting is deleted or expires.
//
// Set 1 (2026-10-20) was 8 of 11 cases on near-identical versions of one
// person's CV. Set 2 caps that persona at two cases and adds designed
// synthetic CVs (synthetic-cvs.ts) across other fields and situations. Set 3
// adds a deliberately sparse CV (one job, two bullets).

import type { LetterNotes } from '@/lib/ai/cover-letter/prompt'

export const EVAL_SET_VERSION = 3

/** Something about the case that a good letter has to handle. */
export type PairTag = 'strong-fit' | 'career-change' | 'gap' | 'overqualified' | 'stretch'

export interface EvalPair {
  id: string
  /**
   * 'local': a key in scripts/demo-seed/demo-content.local.json (real CVs, git-ignored).
   * 'synthetic': a key in SYNTHETIC_CVS.
   * 'real': a CV someone shared with consent, imported by `eval.ts import-cvs`
   *   into the git-ignored output directory as real-cvs/<key>.json.
   */
  source: 'local' | 'synthetic' | 'real'
  resumeKey: string
  /** ScrapedJob _id. */
  jobId: string
  /**
   * 'gap' ends the most recent job early to create an employment gap. The
   * variant is synthetic and labelled as such in reports.
   */
  variant?: 'gap'
  tags: PairTag[]
  /** What the case tests, written for whoever reads the report. */
  note: string
  /** Leave out of judge-calibration sheets (cases already used to tune the judge). */
  skipCalibration?: boolean
}

/** Where the gap variant ends the most recent role. */
export const GAP_VARIANT_END_DATE = '2024-09'

export const EVAL_PAIRS: EvalPair[] = [
  { id: 'p01', source: 'local', resumeKey: 'master', jobId: '6ad5dad3757b5ac2819f49d5', tags: ['strong-fit'], note: 'Solutions architect to an AI solutions engineer role', skipCalibration: true },
  { id: 'p07', source: 'local', resumeKey: 'master', jobId: '6acf4352a0fd7ab7d9329ed0', variant: 'gap', tags: ['gap'], note: 'Synthetic employment gap since 2024-09, partly covered by a GenAI program', skipCalibration: true },
  { id: 'p08', source: 'local', resumeKey: 'sales', jobId: '6acdf1ee2944cdf12e402f2d', tags: ['career-change'], note: 'Sales manager moving into sales data analysis' },
  { id: 'p09', source: 'local', resumeKey: 'gis', jobId: '6acdf1ee2944cdf12e402f2c', tags: ['career-change'], note: 'GIS developer moving into general data analysis' },
  { id: 'p10', source: 'local', resumeKey: 'investor', jobId: '6aa907fb04e18d2d36aebcb4', tags: ['career-change', 'overqualified'], note: 'Board-level investor applying for a senior FP&A analyst role' },
  { id: 's01', source: 'synthetic', resumeKey: 'syn-newgrad', jobId: '6aa3c1cf7c72b737b17f51e7', tags: ['strong-fit'], note: 'New graduate with one internship applying for a student operations analyst role' },
  { id: 's02', source: 'synthetic', resumeKey: 'syn-returner', jobId: '6abb7cd20d0854e3bf49550b', tags: ['gap'], note: 'Lifecycle marketer returning after a 2022-2025 caregiving break' },
  { id: 's03', source: 'synthetic', resumeKey: 'syn-nometrics', jobId: '6ab4e55293bf362120693827', tags: ['career-change'], note: 'Support team lead moving into product operations; the CV has no figures at all' },
  { id: 's04', source: 'synthetic', resumeKey: 'syn-exec', jobId: '6a8cca42eecbd0abcf65d66d', tags: ['overqualified'], note: 'Sitting CFO applying for a senior financial analyst role' },
  { id: 's05', source: 'synthetic', resumeKey: 'syn-nurse', jobId: '6a97e4618e335eedffc2faf3', tags: ['career-change'], note: 'Registered nurse moving into healthcare data analysis; no fraud or Medicaid work in the CV' },
  { id: 's06', source: 'synthetic', resumeKey: 'syn-teacher', jobId: '6a9935dc6f558f90d9d33bda', tags: ['career-change'], note: 'Teacher and grade coordinator moving into R&D project management' },
  { id: 's07', source: 'synthetic', resumeKey: 'syn-soc', jobId: '6a8cca42eecbd0abcf65d66c', tags: ['stretch'], note: 'Tier 1 SOC analyst with military background applying for a senior SOC role' },
  { id: 's08', source: 'synthetic', resumeKey: 'syn-bootcamp', jobId: '6ab393d2a20283ecca82727c', tags: ['career-change', 'stretch'], note: 'Designer turned junior developer applying for a senior web developer role' },
  { id: 's09', source: 'synthetic', resumeKey: 'syn-sparse', jobId: '6aa3c1cf7c72b737b17f51e7', tags: ['stretch'], note: 'One job and two bullets: the letter should be short and claim nothing unsupported' },
]

/**
 * Short candidate notes for the notes experiment (spec 9): what a person
 * would type into the letter's optional fields. Synthetic cases only, so
 * every word is invented.
 */
export const NOTES: Record<string, LetterNotes> = {
  s01: { motivation: 'I want to learn how fraud decisions are made at scale, and an analytics operations team is where the data meets real decisions.' },
  s02: {
    motivation: 'I have used monday.com with clients and like how much of the lifecycle work is product-led.',
    explain: 'I took three years off to care for a parent; I kept my certifications current and freelanced in the last year.',
  },
  s03: { motivation: 'I have spent years fixing the same customer problems by hand and want to fix them in the product instead.' },
  s04: { explain: 'I am stepping back from a CFO role on purpose: I want hands-on analysis work and no longer want to run a department.' },
  s05: { motivation: 'Ten years on hospital wards showed me how much care depends on data quality; I want to work on that data directly.' },
  s06: { motivation: 'Running a school timetable taught me I like coordinating people and deadlines more than teaching itself.' },
  s07: { explain: 'I know this is a step above my current level; I have been taking on the escalations my team lead used to handle.' },
  s08: { explain: 'I moved from design into development two years ago and know a senior role is a stretch; I learn fast and ship every week.' },
  s09: { motivation: 'Scheduling deliveries made me curious about why some routes keep failing, and I want to learn to answer that with data.' },
}
