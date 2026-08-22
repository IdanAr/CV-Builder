import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

const { auth } = NextAuth(authConfig)

export const proxy = auth

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/resumes/:path*',
    '/api/applications/:path*',
    '/api/preview/:path*',
    '/api/jobsearch/:path*',
  ],
}
