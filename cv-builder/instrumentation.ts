// instrumentation.ts
// Next's per-runtime startup hook. Two jobs, both about finding out that
// something is wrong from the server rather than from a user.
import type { Instrumentation } from 'next'

export async function register(): Promise<void> {
  // The edge runtime has no access to most of these variables and never runs
  // the code that needs them, so checking there would only produce noise.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Imported dynamically: a top-level import of lib/env would be evaluated in
  // every runtime this module is loaded into, including the edge one above.
  const { reportEnvOnBoot } = await import('@/lib/env')
  reportEnvOnBoot()
}

/**
 * Every server-side error Next catches, including the ones no route handler
 * funnels through handleRouteError -- render errors, errors thrown before a
 * handler runs, and errors in server components.
 *
 * Deliberately just a structured console.error: Vercel captures stdout, so
 * this is already queryable, and picking an external aggregator (Sentry,
 * Axiom, Better Stack) is a cost and vendor decision. This is the single
 * place to add one when that decision is made.
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  console.error(
    '[request-error]',
    JSON.stringify({
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    }),
    err
  )
}
