const js = require("@eslint/js");
const globals = require("globals");

// Flat config. ESLint ignores node_modules and .git by default.
module.exports = [
  {
    ignores: [".context/**"]
  },
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
    // Node server and this config file (CommonJS).
    files: ["server.js", "lib/**/*.js", "eslint.config.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        fetch: "readonly"
      }
    }
  }
];
