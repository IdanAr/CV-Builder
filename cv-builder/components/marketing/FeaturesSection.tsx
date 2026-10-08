import { Sparkles, Target, KanbanSquare, Radar } from 'lucide-react'

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
  {
    icon: Radar,
    title: 'Automated Job Matching',
    description:
      'Set your criteria once and Job Search scans job boards and companies you watch, scoring and tailoring matches for you to review.',
  },
] as const

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-medium tracking-tight text-fg-heading">Everything You Need to Get Hired</h2>
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-card border border-border bg-surface p-6"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-control bg-surface-selected text-fg-body">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-medium text-fg-heading">{title}</h3>
            <p className="mt-2 text-sm text-fg-body">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
