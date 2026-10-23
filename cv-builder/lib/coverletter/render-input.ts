// lib/coverletter/render-input.ts
// What a letter renderer is handed. Type only and client-safe: the PDF template,
// the DOCX builder and the export input helper all import it, so it must stay free
// of server code and runtime imports.
import type { LetterDesign } from './design'
import type { LetterLanguage } from './header'

export interface CoverLetterRenderInput {
  /** The letter body: greeting, paragraphs, "- " list lines and sign-off, as plain text. */
  content: string
  design: LetterDesign
  language: LetterLanguage
  name?: string
  /** One line: email · phone · city · profile URL. Omitted when empty. */
  contact?: string
  date?: string
  /** Recipient lines (hiring manager, company), one per line. Empty for none. */
  recipient: string[]
  /** The subject line ("Re: Role, Company"), or null for none. */
  subject: string | null
  /** The file's document title. */
  title: string
  /** Picker name of the body font. */
  font?: string
  /** Picker name of the name's font; falls back to the body font. */
  headerFont?: string
  /** Hex colour of the rule or edge and the accent-edge name. */
  accentColor?: string
  /** `meta.fontScale`, 0.9 to 1.1; 1 when omitted. */
  fontScale?: number
}
