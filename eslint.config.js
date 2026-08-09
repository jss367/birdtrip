const js = require("@eslint/js");
const globals = require("globals");

// Flat config. ESLint ignores node_modules and .git by default.
// The shipped app stays dependency-free; ESLint is a devDependency only.
module.exports = [
  js.configs.recommended,
  {
    // Browser client, loaded as a classic script (not a module).
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        L: "readonly",
        lucide: "readonly"
      }
    }
  },
  {
    // Node server, tests, and config files (CommonJS). Tests also get browser
    // globals for code inside page.evaluate callbacks.
    files: ["server.js", "eslint.config.js", "playwright.config.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.browser,
        fetch: "readonly"
      }
    }
  }
];
