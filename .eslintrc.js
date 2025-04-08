/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    extends: ["@mendix/pluggable-widgets-tools/configs/eslint.ts.base.json"],
    parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        sourceType: "module"
    },
    ignorePatterns: [".eslintrc.js"]
};
