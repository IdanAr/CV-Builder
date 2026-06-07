import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { parseFile, ParseError } from '@/lib/upload/parse-file'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided', code: 'BAD_REQUEST' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF and DOCX files are supported', code: 'UNSUPPORTED_FORMAT' },
      { status: 400 }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File must be 5 MB or smaller', code: 'FILE_TOO_LARGE' },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await parseFile(buffer, file.type)
    return NextResponse.json({ text })
  } catch (err) {
    if (err instanceof ParseError) {
      return NextResponse.json({ error: err.message, code: 'PARSE_FAILED' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
