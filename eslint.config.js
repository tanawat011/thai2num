import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "coverage/", "demo/", "src/generated/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-irregular-whitespace": ["error", { skipStrings: false, skipRegExps: false, skipTemplates: false, skipComments: false }],
    },
  },
);
