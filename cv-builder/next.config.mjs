// Every @fontsource package the PDF font registry can resolve. Kept in sync
// with FONT_SUBSTITUTES in lib/fonts/families.ts — lib/fonts/__tests__/tracing.test.ts
// fails if a family is added there and not traced here.
//
// `*-latin*.woff` deliberately, NOT `*-latin*-normal.woff`: the -normal form
// silently drops all four italic files per family. The registry registers
// italic explicitly and ExecutivePdfTemplate renders fontStyle: 'italic', so an
// untraced italic face would be a production-only failure. The pattern still
// excludes .woff2, which Font.register rejects, and covers both weights and
// the latin-ext subset that carries U+20AA.
const FONT_GLOBS = [
  'carlito', 'caladea', 'arimo', 'gelasio', 'eb-garamond',
  'lato', 'roboto', 'ibm-plex-sans',
].map(slug => `./node_modules/@fontsource/${slug}/files/*-latin*.woff`)

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse', 'mongodb', 'mongoose'],
  // The PDF renderer reads these at runtime from a path built at runtime, which
  // the tracer cannot follow; without an explicit include they are dropped from
  // the serverless bundle and exports fail in production only.
  // Keys are matched as GLOBS, so a literal dynamic-route path does not work:
  // in a glob, `[id]` is a character class matching a single "i" or "d", so
  // '/api/resumes/[id]/export/pdf' matches no route at all and the entry is
  // silently ignored — no warning, no error, and the .nft.json comes out
  // without the files. Verified by build: the literal key yields 0 font
  // entries for the docx route, the wildcard below yields them. Use `**`.
  outputFileTracingIncludes: {
    '/api/resumes/**': FONT_GLOBS,
    '/api/preview/**': FONT_GLOBS,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
