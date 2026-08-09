const TESTIMONIALS = [
  {
    quote:
      "The ATS score feature helped me realize my resume wasn't being read. After fixing it, I got 3 interviews in a week!",
    author: 'Anna T.',
    role: 'Data Analyst',
  },
  {
    quote: 'The AI rewrote my bullet points to actually sound like accomplishments. I felt confident applying again.',
    author: 'Daniel K.',
    role: 'Marketing Manager',
  },
  {
    quote: 'Uploading my old PDF and having it parsed straight into an editable resume saved me hours.',
    author: 'Roni S.',
    role: 'Software Engineer',
  },
  {
    quote: 'I had the chance to test this application and it exceeded my expectations. The application track is a game-changer.',
    author: 'Adam L.',
    role: 'Graphic Designer',
  },
] as const

export function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Success Stories</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {TESTIMONIALS.map(({ quote, author, role }) => (
          <figure
            key={author}
            className="rounded-2xl border border-indigo-100 bg-white/70 backdrop-blur-xl p-6 shadow-sm"
          >
            <blockquote className="text-sm text-gray-700">&ldquo;{quote}&rdquo;</blockquote>
            <figcaption className="mt-4 text-sm font-semibold text-gray-900">
              {author} <span className="font-normal text-gray-500">&middot; {role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
