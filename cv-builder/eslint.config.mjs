import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([{
    extends: [...nextCoreWebVitals, ...nextTypescript],

    rules: {
        // eslint-config-next 16 bundles eslint-plugin-react-hooks@7, which adds
        // several new React Compiler-aligned rules not present in the v5 series
        // this project's baseline was linted against (e.g. no `set-state-in-effect`
        // rule existed before this upgrade). It flags several pre-existing
        // mount-time `setState` calls in effects across the codebase (EditorShell,
        // ExportMenu, PreviewTab, MonthYearPicker, UserProfileButton,
        // use-media-query, use-pdf-pagination). Fixing those is a real behavioral
        // change to components covered by Task 3's manual smoke test and is out of
        // scope for this mechanical dependency upgrade — tracked as follow-up work,
        // not fixed here.
        "react-hooks/set-state-in-effect": "off",
    },
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