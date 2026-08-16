import { Star } from 'lucide-react'
import { Marquee } from './Marquee'

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

function FiveStars() {
  return (
    <div className="mt-4 flex items-center gap-0.5" role="img" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Success Stories</h2>
      <p className="mt-2 text-center text-sm text-gray-600">Based on early beta feedback</p>
      <div className="mt-10">
        <Marquee
          ariaLabel="Success Stories"
          durationSeconds={35}
          items={TESTIMONIALS.map(({ quote, author, role }) => (
            <figure
              key={author}
              className="w-80 rounded-2xl border border-indigo-100 bg-white/70 backdrop-blur-xl p-6 shadow-sm"
            >
              <blockquote className="text-sm text-gray-700">&ldquo;{quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-gray-900">
                {author} <span className="font-normal text-gray-500">&middot; {role}</span>
              </figcaption>
              <FiveStars />
            </figure>
          ))}
        />
      </div>
    </section>
  )
}
