# Testing Process for PostgreSQL Deparser

## Overview
This document outlines the testing process for the PostgreSQL Deparser package, following the development workflow described in DEVELOPMENT.md and AGENTS.md.

## Test Execution

### Prerequisites
- Yarn and Lerna installed
- Dependencies installed via `yarn` in root directory
- Project built via `yarn build`

### Running Tests
```bash
cd packages/deparser
yarn test                # Run all tests
yarn test:watch         # Run tests in watch mode
```

### Individual Test Execution
For debugging specific failures:
```bash
yarn test --testNamePattern="test-name"
```

## Test Coverage Requirements
- Target: 100% test coverage
- All tests must pass before merging
- No regressions allowed

## Testing Workflow
1. Run individual failing tests during development
2. Fix issues in tight debugging loops
3. Run full test suite to check for regressions
4. Verify 100% coverage before PR submission

## Current Status
✅ All tests passing (252/252 test suites, 265/265 tests)
✅ 100% test coverage achieved
✅ Fixed COPY statement DefElem formatting
✅ All parsing issues resolved by upstream fixes

## Recent Fixes
- **COPY Statement Formatting**: Fixed DefElem to generate `WITH (FORMAT CSV)` instead of `WITH (format = 'csv')` for CopyStmt context
- **Parsing Issues**: Resolved by Dan's upstream fixes with new statement-splitter utility and improved fixture generation

## Development Guidelines
- Follow the context-driven rendering approach outlined in AGENTS.md
- Use tight testing loops for efficient debugging
- Ensure all changes maintain backward compatibility
- Run tests in isolation when debugging specific issues
- Check for regressions after each fix

## Debugging Process
1. Identify failing tests using `yarn test`
2. Run individual tests with `--testNamePattern` for focused debugging
3. Analyze AST differences and deparser output
4. Apply fixes following existing code patterns
5. Verify fixes don't break other tests
6. Confirm 100% test coverage before submission
