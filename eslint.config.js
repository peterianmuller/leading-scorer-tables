import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

// The client runs in the browser; server.js, the tests and the build config
// run in Node. Formatting is left to Prettier.
export default defineConfig([
  globalIgnores(["dist", "test/fixtures"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["client/**/*.{js,jsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["server.js", "vite.config.js", "eslint.config.js", "test/**/*.js"],
    languageOptions: { globals: globals.node },
  },
]);
