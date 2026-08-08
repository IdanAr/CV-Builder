import Link from 'next/link'

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/40 bg-white/40 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
          CV Builder
        </span>
        <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} CV Builder. All rights reserved.</p>
        <Link href="/signin" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Sign In
        </Link>
      </div>
    </footer>
  )
}
