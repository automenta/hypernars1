import globals from "globals";
import pluginJs from "@eslint/js";
import pluginJest from "eslint-plugin-jest";
import pluginReact from "eslint-plugin-react";

export default [
  {
    rules: {
      "no-unused-vars": "warn",
    },
  },
  {languageOptions: { globals: {...globals.browser, ...globals.node} }},
  pluginJs.configs.recommended,
  {
    files: ["**/*.test.js"],
    plugins: {
      jest: pluginJest,
    },
    rules: {
        ...pluginJest.configs.recommended.rules,
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/prefer-to-have-length": "warn",
        "jest/valid-expect": "error"
    }
  },
  {
    files: ["src/tui/**/*.js"],
    plugins: {
      react: pluginReact,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
