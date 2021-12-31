module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.json",
    },
    plugins: ["@typescript-eslint", "security", "prettier"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
        "plugin:security/recommended",
    ],
    rules: {
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/space-infix-ops": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/typedef": [
            "error",
            {
                arrayDestructuring: true,
                arrowParameter: true,
                memberVariableDeclaration: true,
                objectDestructuring: true,
                parameter: true,
                propertyDeclaration: true,
                variableDeclaration: true,
            },
        ],
        "@typescript-eslint/unified-signatures": "error",
        "prettier/prettier": ["error"],
        "security/detect-non-literal-fs-filename": "off",
        "security/detect-object-injection": "off",
        "sort-imports": [
            "error",
            {
                allowSeparatedGroups: true,
                ignoreCase: true,
            },
        ],
    },
};
