export interface JobPosting {
  source: 'freehire' | 'comeet'
  sourceId: string
  title: string
  company: string
  location?: string
  url: string
  description: string
  postedAt?: Date
  workMode?: 'remote' | 'hybrid' | 'onsite'
}

export interface SourceSearchResult {
  postings: JobPosting[]
  degraded: boolean
  errorMessage?: string
}
