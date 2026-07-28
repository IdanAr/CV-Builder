import type { IStylesOptions } from 'docx'

/**
 * Real Word paragraph styles. ATS parsers use the style hierarchy to identify
 * section boundaries; direct `<w:sz>` formatting carries no such signal, which
 * is what the exports previously relied on.
 *
 * These override docx's built-in Title/Heading1/Heading2 styles via
 * `styles.default` rather than declaring new `paragraphStyles` entries with
 * the same ids. docx's `DefaultStylesFactory` always emits a Title/Heading1/
 * Heading2 style (see its `importedStyles` list) regardless of what a caller
 * passes — a `paragraphStyles` array reusing those ids would produce a
 * *second*, colliding `<w:style w:styleId="Heading1">` element rather than
 * replacing the first. `styles.default.title` / `.heading1` / `.heading2` is
 * the mechanism the library exposes specifically to customize those built-ins
 * in place, so the emitted styles.xml has exactly one definition per id.
 */
export function buildDocxStyles(
  theme: { nameSize: number; headingSize: number; sectionTitleColor: string },
  headFont: string,
  bodyFont: string
): IStylesOptions {
  const heading = (size: number, bold: boolean) => ({
    run: { font: headFont, size, bold, color: theme.sectionTitleColor.replace('#', '') },
    paragraph: { spacing: { before: 270, after: 120 }, keepNext: true },
  })

  return {
    default: {
      title: {
        run: { font: headFont, size: theme.nameSize, bold: true },
        paragraph: { spacing: { after: 60 }, keepNext: true },
      },
      // Heading1 owns its bold: `sectionHeading` no longer sets it on the run.
      heading1: heading(theme.headingSize, true),
      // Heading2 must NOT, even though it is a heading. It is applied to entry
      // heads, whose paragraph holds two runs: the entry name, which sets
      // `bold: true` itself, and the date range, which sets no `bold` at all.
      // Under ECMA-376 §17.7.2 an absent `<w:b>` on a run means *inherit*, not
      // *off* — so a bold style silently bolded every work and volunteer date
      // range while the identically-shaped dates on education, awards,
      // publications and projects (not under Heading2) stayed regular.
      heading2: heading(Math.max(theme.headingSize - 2, 20), false),
      document: { run: { font: bodyFont, size: 22 } },
    },
  }
}
