import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // src/core is the framework-free review engine. It must not depend on
    // Next.js or the database layer so it can later be extracted as a
    // standalone package (CLI / MCP server). Persistence is injected via
    // repository interfaces defined inside core.
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-*", "@/db", "@/db/*", "@/app/*", "@/components/*"],
              message:
                "src/core must stay framework-free: no next/react/db/app imports. Inject dependencies via interfaces.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
