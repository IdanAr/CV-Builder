const STEPS = [
  { title: 'Start or Upload', description: 'Choose a template or upload your current PDF/DOCX to let our parser do the heavy lifting.' },
  { title: 'Edit & Enhance', description: 'Use the drag-and-drop editor and AI suggestions to refine your experience.' },
  { title: 'ATS Check', description: 'Run the ATS Semantic Match to fix missing keywords.' },
  { title: 'Export & Apply', description: 'Download as PDF or DOCX and track your application on the dashboard.' },
] as const

export function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">How It Works</h2>
      <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ title, description }, i) => (
          <li key={title} className="text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-600">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
