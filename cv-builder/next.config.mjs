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
  // '@napi-rs/canvas' provides the DOMMatrix polyfill pdf-parse (pdfjs-dist)
  // needs in Node. It ships prebuilt native binaries per-platform, which
  // bundling breaks — keep it external like pdf-parse itself so Vercel's
  // file tracer picks up the right platform binary instead of a broken
  // bundle. Without this, pdf-parse crashes at import time in production
  // with "ReferenceError: DOMMatrix is not defined" (works locally because
  // the whole app runs as one process there, not Vercel's isolated
  // per-route Lambda).
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', 'mongodb', 'mongoose'],
  // Belt-and-braces, not a fix for a live failure. Measured: a build with this
  // block removed still traced all 64 required faces into the pdf and
  // pagination routes, because nft infers a `*.woff` wildcard from the runtime
  // path construction in registry.ts. This pins that behaviour so an
  // undocumented inference cannot regress silently on a Next upgrade.
  //
  // ── IF THE BUILD PANICS, START HERE ──────────────────────────────────────
  //   FATAL: An unexpected Turbopack error occurred.
  //   Error [TurbopackInternalError]: '<path>' is a symlink causes that
  //   causes an infinite loop!
  //     - Execution of <NftJsonAsset as Asset>::content failed
  //     - Execution of read_glob failed
  //
  // That is this block. Declaring any `outputFileTracingIncludes` entry makes
  // the tracer walk node_modules, so a single self-referential symlink
  // anywhere under it aborts the whole build with the message above, which
  // names the symlink but never mentions this config.
  //
  // Fix: delete the offending link (`rm node_modules/node_modules`), not this
  // config. Narrowing the pattern does NOT help — verified by replacing the
  // glob with 64 fully literal file paths, which panics identically. The walk
  // is triggered by the option itself, not by the pattern's breadth.
  //
  // Removing this block also makes the build pass, which is a tempting wrong
  // turn: it trades an obvious build failure for a silent production one.
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
