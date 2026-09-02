import type { Config } from "tailwindcss";
import {
  PALETTE,
  SEMANTIC,
  paletteVar,
  semanticVar,
  type PaletteFamily,
  type PaletteScale,
  type SemanticToken,
} from "./lib/design/color-tokens";

/**
 * Tokens reach Tailwind by reference, never by value: the channels live in
 * app/globals.css as custom properties, and every utility resolves through
 * `rgb(var(--…) / <alpha-value>)`. That indirection is what makes
 * `bg-surface/70` work — the app uses 13 distinct white alphas — and what
 * would let a `.dark` block re-point the whole interface by redefining the
 * variables alone.
 */
const token = (cssVar: string) => `rgb(var(${cssVar}) / <alpha-value>)`;

const paletteColors = Object.fromEntries(
  (Object.keys(PALETTE) as PaletteFamily[]).map((family) => [
    family,
    Object.fromEntries(
      (Object.keys(PALETTE[family]) as unknown as Array<keyof PaletteScale>).map((step) => [
        step,
        token(paletteVar(family, step)),
      ]),
    ),
  ]),
);

const semanticColors = Object.fromEntries(
  (Object.keys(SEMANTIC) as SemanticToken[]).map((name) => [name, token(semanticVar(name))]),
);

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // Deliberately .{js,jsx,tsx,mdx} here, not .ts: every app/ file that can
    // carry a Tailwind className is a .tsx (page/layout/component) or .jsx
    // file — plain .ts files under app/ are always route.ts API handlers,
    // which never contain classNames. Scanning them anyway used to include
    // app/api/**/route.ts, and a dynamic-route bracket directory there
    // (e.g. app/api/jobsearch/rules/[id]/) triggers a Tailwind 3.4 content-
    // scanning crash (ENOENT on a mangled path) whenever a .ts file inside
    // it changes. Dropping .ts from this glob avoids the crash and is
    // correct regardless, since those files were never real content.
    "./app/**/*.{js,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ...paletteColors,
        // Semantic names win where they collide with a palette family name
        // (`border`, `ring`), which is the intent: those roles are the ones
        // components should be reaching for.
        ...semanticColors,
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      borderRadius: {
        // The interface had grown eight radius values with no rule for
        // choosing between them. These three are the scale; `rounded-full`
        // stays available for pills and avatars.
        control: "0.5rem",
        card: "0.75rem",
        overlay: "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
