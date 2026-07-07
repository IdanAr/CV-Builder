import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PatchBoardConfigSchema } from '@/lib/schemas/application.zod'
import {
  getOrCreateBoardConfig,
  patchBoardConfig,
  BoardConfigValidationError,
} from '@/lib/api/board-config'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    // Auto-creates the default config (built-in columns + seeded status
    // options) on a user's first visit — the table is usable without setup.
    const boardConfig = await getOrCreateBoardConfig(req.auth.user.id)
    return NextResponse.json({ boardConfig })
  } catch (err) {
    return handleRouteError(err, 'GET /api/applications/board-config')
  }
})

export const PATCH = auth(async function PATCH(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const body = await req.json()
    const result = PatchBoardConfigSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const boardConfig = await patchBoardConfig(req.auth.user.id, result.data)
    if (!boardConfig) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ boardConfig })
  } catch (err) {
    if (err instanceof BoardConfigValidationError) {
      return apiError('VALIDATION_ERROR', err.message, 400)
    }
    return handleRouteError(err, 'PATCH /api/applications/board-config')
  }
})
