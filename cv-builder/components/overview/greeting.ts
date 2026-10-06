/** Time-of-day greeting; the name is the first whitespace-separated token, if any. */
export function greetingFor(hour: number, name?: string | null): string {
  const phrase = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = name?.trim().split(/\s+/)[0]
  return first ? `${phrase}, ${first}` : phrase
}
