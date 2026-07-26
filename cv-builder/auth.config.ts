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
    authorized({ auth }) {
      return !!auth?.user
    },
  },
}
