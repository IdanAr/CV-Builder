const PLACEHOLDER_COMPANIES = ['NORTHWIND', 'GLOBEX', 'INITECH', 'UMBRELLA CO.', 'STELLAR SYSTEMS', 'BRAMBLEWOOD']

export function SocialProofSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <p className="text-center text-sm font-medium uppercase tracking-wide text-gray-500">
        Helping thousands land jobs at top companies
      </p>
      <ul aria-label="Companies" className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {PLACEHOLDER_COMPANIES.map((name) => (
          <li key={name} className="text-lg font-bold tracking-widest text-gray-500 select-none">
            {name}
          </li>
        ))}
      </ul>
    </section>
  )
}
