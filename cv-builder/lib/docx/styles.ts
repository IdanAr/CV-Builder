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
  const heading = (size: number) => ({
    run: { font: headFont, size, bold: true, color: theme.sectionTitleColor.replace('#', '') },
    paragraph: { spacing: { before: 270, after: 120 }, keepNext: true },
  })

  return {
    default: {
      title: {
        run: { font: headFont, size: theme.nameSize, bold: true },
        paragraph: { spacing: { after: 60 }, keepNext: true },
      },
      heading1: heading(theme.headingSize),
      heading2: heading(Math.max(theme.headingSize - 2, 20)),
      document: { run: { font: bodyFont, size: 22 } },
    },
  }
}
