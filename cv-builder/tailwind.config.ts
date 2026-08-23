import type { Config } from "tailwindcss";

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
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
