// scripts/cover-letter-eval/variant-b.ts
// Variant B of the cover letter writer now lives in the app; the harness
// keeps importing it under its old name.
export { writeCoverLetterWithCritique as writeCoverLetterB } from '@/lib/ai/cover-letter/write-with-critique'
