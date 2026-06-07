import { CreateResumeSchema, ResumeMetaSchema, ResumeDataSchema, PatchResumeSchema } from './lib/schemas/resume.zod'

async function main() {
  // 1. SHARED MUTABLE DEFAULT
  const r1 = CreateResumeSchema.parse({ title: 'A' })
  const r2 = CreateResumeSchema.parse({ title: 'B' })
  console.log('=== Shared default reference ===')
  console.log('Same meta reference?', r1.meta === r2.meta)
  console.log('Same data reference?', r1.data === r2.data);
  (r1.meta as any).templateId = 'MUTATED'
  console.log('r2.meta.templateId after mutating r1:', r2.meta.templateId)

  // 2. REFERENCES FIELD
  console.log('\n=== References field ===')
  const refResult = ResumeDataSchema.safeParse({ references: [{ name: 'John', reference: 'Great' }] })
  console.log('references field parse success:', refResult.success)
  if (refResult.success) console.log('references in output:', JSON.stringify((refResult.data as any).references))

  // 3. IMAGE FIELD
  console.log('\n=== Image URL validation ===')
  const imgResult = ResumeDataSchema.safeParse({ basics: { image: 'not-a-url' } })
  console.log('image non-URL accepted:', imgResult.success)

  // 4. LINE SPACING RANGE
  console.log('\n=== LineSpacing range ===')
  console.log('1.0 ok:', ResumeMetaSchema.safeParse({ lineSpacing: 1.0 }).success)
  console.log('1.15 ok:', ResumeMetaSchema.safeParse({ lineSpacing: 1.15 }).success)
  console.log('1.16 rejected:', !ResumeMetaSchema.safeParse({ lineSpacing: 1.16 }).success)
  console.log('1.5 rejected:', !ResumeMetaSchema.safeParse({ lineSpacing: 1.5 }).success)

  // 5. COLOR VALIDATION
  console.log('\n=== Color validation ===')
  console.log('empty color accepted:', ResumeMetaSchema.safeParse({ primaryColor: '' }).success)
  console.log('arbitrary string accepted:', ResumeMetaSchema.safeParse({ primaryColor: 'red' }).success)

  // 6. PATCH META PRESERVES CONSTRAINTS
  console.log('\n=== Patch meta constraints ===')
  console.log('pageMargins 99 in patch rejected:', !PatchResumeSchema.safeParse({ meta: { pageMargins: 99 } }).success)
  console.log('lineSpacing 1.5 in patch rejected:', !PatchResumeSchema.safeParse({ meta: { lineSpacing: 1.5 } }).success)

  // 7. data default shared reference
  const d1 = CreateResumeSchema.parse({ title: 'X' })
  const d2 = CreateResumeSchema.parse({ title: 'Y' })
  console.log('\n=== data default shared reference ===')
  console.log('Same data reference?', d1.data === d2.data);
  (d1.data as any).injected = 'test'
  console.log('d2.data.injected after mutating d1.data:', (d2.data as any).injected)
}

main().catch(console.error)
