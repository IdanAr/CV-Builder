import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([{
    extends: [...nextCoreWebVitals, ...nextTypescript],
}, {
    files: ["**/*.test.ts", "**/*.test.tsx"],

    rules: {
        "@typescript-eslint/no-unused-vars": "off",
    },
}, {
    // Standalone dev/debug script, not part of the app or any npm script, and
    // was never covered by `next lint`'s default (app/pages/components/lib/src)
    // scope. `eslint .` now lints repo-wide, so exclude it explicitly to
    // preserve prior lint scope rather than rewriting a throwaway script.
    ignores: ["verify-schemas.ts"],
}]);