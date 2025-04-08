module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    transform: {
        "^.+\\.(ts|tsx)$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.json",
                diagnostics: {
                    ignoreCodes: [151001]
                }
            }
        ]
    },
    transformIgnorePatterns: [
        "node_modules/(?!(d3|d3-array|d3-sankey|internmap|delaunator|robust-predicates)/)"
    ],
    moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy"
    },
    collectCoverage: true,
    coverageReporters: ["text", "lcov"],
    coveragePathIgnorePatterns: [
        "/node_modules/",
        "/dist/",
        "/__tests__/"
    ],
    setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
    testMatch: ["**/__tests__/**/*.test.ts?(x)"],
    verbose: true,
    testTimeout: 10000,
    maxWorkers: "50%"
}; 