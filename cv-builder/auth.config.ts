import type { NextAuthConfig } from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  providers: [
    // GitHub and Google both verify email ownership, so linking a new provider
    // to an existing user with the same email is safe here.
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    // The QStash-triggered scan pipeline (design spec §6) has no user
    // session: the cron route authenticates via CRON_SECRET
    // (app/api/jobsearch/scan/cron/route.ts) and the worker route via
    // QStash's own signature verification
    // (app/api/jobsearch/scan/worker/route.ts's verifySignatureAppRouter).
    // Both would otherwise be rejected here since proxy.ts's matcher covers
    // all of /api/jobsearch/:path*.
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname
      if (path.startsWith('/api/jobsearch/scan/cron') || path.startsWith('/api/jobsearch/scan/worker')) {
        return true
      }
      return !!auth?.user
    },
  },
}
