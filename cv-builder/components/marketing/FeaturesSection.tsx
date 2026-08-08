import { Sparkles, Target, KanbanSquare } from 'lucide-react'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Write with AI',
    description:
      "Overcome writer's block. Let our AI suggest bullet points, rewrite your experience, and generate matching cover letters tailored to your target job.",
  },
  {
    icon: Target,
    title: 'ATS Optimization & Scoring',
    description:
      'Get instant feedback with our ATS Score and Semantic Match engine. We analyze your CV against real job descriptions to ensure you pass the screening phase.',
  },
  {
    icon: KanbanSquare,
    title: 'Track Your Success',
    description:
      "Manage your job hunt in one place. Move applications from 'Applied' to 'Interviewing' with our built-in tracker.",
  },
] as const

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Everything You Need to Get Hired</h2>
      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-2xl border border-indigo-100 bg-white/70 backdrop-blur-xl p-6 shadow-sm"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-600">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
