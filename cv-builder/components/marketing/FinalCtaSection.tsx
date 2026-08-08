import Link from 'next/link'

export function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 text-center">
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-16 shadow-xl">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Ready to land your dream job?</h2>
        <p className="mt-4 text-lg text-indigo-100">Join thousands of successful job seekers today.</p>
        <Link
          href="/signin"
          className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50"
        >
          Create Your Free CV
        </Link>
      </div>
    </section>
  )
}
