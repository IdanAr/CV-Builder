import { Packer } from 'docx'
import { auth } from '@/lib/auth'
import { loadLetterForExport } from '@/lib/api/cover-letter-export'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { checkRateLimit, EXPORT_RATE_LIMIT } from '@/lib/rate-limit'
import { buildCoverLetterDocx } from '@/lib/docx/cover-letter-docx'
import { applyFontScaleToDocx } from '@/lib/docx/scale-docx'
import { contentDisposition } from '@/lib/coverletter/export-input'

export const POST = auth(async (req, ctx) => {
  const userId = req.auth?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = await checkRateLimit(`${userId}:export`, EXPORT_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many export requests - please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const { id, letterId } = await (ctx?.params as Promise<{ id: string; letterId: string }>)
    const loaded = await loadLetterForExport(userId, id, letterId, new Date())
    if (!loaded.ok) return loaded.response

    const raw = await Packer.toBuffer(buildCoverLetterDocx(loaded.input))
    // The builder ignores fontScale; the shared scaler applies it to the finished file.
    const buffer = await applyFontScaleToDocx(raw, loaded.meta.fontScale ?? 1)

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': contentDisposition(loaded.input.title, 'docx'),
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/cover-letters/[letterId]/export/docx')
  }
})
