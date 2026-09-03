import { auth } from '@/lib/auth'
import { exportUserData } from '@/lib/api/account'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

/**
 * The signed-in user's own data, as a JSON file.
 *
 * `Content-Disposition: attachment` rather than letting the browser render it:
 * the point is to hand someone a copy they keep, and a 4MB JSON blob painted
 * into a tab is not that.
 *
 * `Cache-Control: no-store` because this is the whole of someone's résumé and
 * application history; it has no business sitting in a shared proxy or in the
 * browser's disk cache after they sign out.
 */
export const GET = auth(async function GET(req) {
  const user = req.auth?.user
  if (!user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const data = await exportUserData(user.id, { name: user.name, email: user.email })
    const stamp = new Date().toISOString().slice(0, 10)
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cv-builder-export-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return handleRouteError(err, 'GET /api/account/export')
  }
})
