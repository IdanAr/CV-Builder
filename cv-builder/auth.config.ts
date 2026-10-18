import type { NextAuthConfig } from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

/**
 * Where a refused Google sign-in lands. The sign-in page maps the code to a
 * message (app/(auth)/signin/page.tsx).
 */
export const GOOGLE_EMAIL_UNVERIFIED_REDIRECT = '/signin?error=GoogleEmailUnverified'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  // No allowDangerousEmailAccountLinking (security audit SEC-002). With it on,
  // a sign-in from a provider account this app had never seen was attached to
  // whichever existing user had the same email address, so the email a
  // provider *reports* was enough to enter someone's account. Now:
  //   - a new provider account whose email matches an existing user is refused
  //     with OAuthAccountNotLinked;
  //   - the owner links a second provider deliberately, from
  //     Settings > Connected accounts, while signed in. Auth.js then attaches
  //     the new provider account to the signed-in user (it reads the JWT
  //     session on the callback), which proves control of both logins.
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    /**
     * Google returns email_verified in its OpenID profile; Auth.js does not
     * check it. An unverified address is the provider saying "we don't know
     * this person owns that inbox", so it is not used to sign anyone in.
     * GitHub only exposes verified addresses as the account's public or
     * primary email, so it needs no equivalent check.
     */
    signIn({ account, profile }) {
      if (account?.provider === 'google' && profile?.email_verified !== true) {
        return GOOGLE_EMAIL_UNVERIFIED_REDIRECT
      }
      return true
    },
    // The QStash-triggered scan pipeline (design spec §6) has no user
    // session: the cron route authenticates via CRON_SECRET
    // (app/api/jobsearch/scan/cron/route.ts) and the worker route via
    // QStash's own signature verification
    // (app/api/jobsearch/scan/worker/route.ts's verifySignatureAppRouter).
    // Both would otherwise be rejected here since proxy.ts's matcher covers
    // all of /api/jobsearch/:path*.
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname
      if (path === '/api/jobsearch/scan/cron' || path === '/api/jobsearch/scan/worker') {
        return true
      }
      return !!auth?.user
    },
  },
}
