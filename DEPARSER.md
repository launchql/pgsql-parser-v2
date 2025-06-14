# PostgreSQL Deparser Documentation

## Overview

The `@pgsql/deparser` package provides pure TypeScript functionality to convert PostgreSQL Abstract Syntax Trees (ASTs) back into valid SQL strings. This enables symmetric parsing and deparsing workflows where SQL can be parsed into ASTs, manipulated programmatically, and then converted back to SQL while preserving semantic correctness.

## Current Implementation Status

### Architecture
- **Main Class**: `Deparser` class in `packages/deparser/src/deparser.ts` (4,221 lines)
- **Target Version**: PostgreSQL 17 (package version 17.0.0)
- **Dependencies**: 
  - `@pgsql/types` for AST type definitions
  - `pgsql-enums` for PostgreSQL enum mappings
  - `dotty` for object property access utilities

### Core Components

#### 1. AST Node Handlers
The deparser implements individual methods for each PostgreSQL AST node type:

**Statement Types**:
- `SelectStmt` - SELECT queries with complex clause handling
- `InsertStmt` - INSERT statements with conflict resolution
- `UpdateStmt` - UPDATE statements with joins and conditions
- `DeleteStmt` - DELETE statements
- `CreateStmt` - CREATE TABLE with constraints, inheritance
- `AlterTableStmt` - ALTER TABLE operations
- `CreateFunctionStmt` - Function definitions
- `CreateIndexStmt` - Index creation
- `GrantStmt` - Permission grants

**Expression Types**:
- `A_Expr` - General expressions (operators, comparisons)
- `FuncCall` - Function calls with parameters
- `ColumnRef` - Column references
- `TypeCast` - Type casting operations
- `SubLink` - Subqueries
- `BoolExpr` - Boolean logic (AND, OR, NOT)
- `CaseExpr` - CASE expressions

**Utility Types**:
- `TypeName` - Data type specifications (known issues area)
- `RangeVar` - Table/view references
- `Alias` - Column and table aliases
- `ResTarget` - SELECT list items
- `SortBy` - ORDER BY clauses
- `GroupingSet` - GROUP BY specifications

#### 2. Helper Functions

**String Processing**:
```typescript
quote(name: string): string          // Identifier quoting
escape(literal: string): string     // String literal escaping
needsQuotes(name: string): boolean   // Determine if quoting needed
```

**List Processing**:
```typescript
list(items: any[], separator: string, prefix: string, context?: any): string
listQuotes(items: any[]): string
deparseNodes(nodes: any[], context?: any): string[]
```

**Formatting**:
```typescript
compact(items: any[]): any[]         // Remove null/undefined items
flatten(items: any[]): any[]         // Flatten nested arrays
parens(content: string): string      // Add parentheses
unwrapList(node: any): any[]         // Extract list from wrapped nodes
```

#### 3. Reserved Words and Keywords
Maintains comprehensive list of PostgreSQL reserved words requiring quoting:
- SQL keywords (SELECT, FROM, WHERE, etc.)
- PostgreSQL-specific keywords
- Type names and built-in functions

#### 4. Type System Integration
- Uses `@pgsql/types` for TypeScript type safety
- Imports from `@pgsql/utils/wrapped` for wrapped node types
- Leverages `pgsql-enums` for constraint and object type mappings

## Testing Framework

### Test Structure
- **Kitchen Sink Tests**: Comprehensive round-trip validation using 232 SQL fixture files
- **Simple Usage Tests**: Basic API validation with snapshot testing
- **Format Tests**: Custom newline/tab character support
- **Future Tests**: Forward compatibility testing

### Test Patterns
```typescript
// Round-trip validation
const sql = "SELECT * FROM users WHERE id = 1";
const ast = parse(sql);
const deparsed = deparse(ast);
expect(deparsed).toBe(sql);

// Snapshot testing for complex cases
expect(deparse(complexAst)).toMatchSnapshot();
```

### SQL Fixture Coverage
The `__fixtures__` directory contains 232 SQL files covering:
- DDL: CREATE TABLE, ALTER TABLE, CREATE INDEX
- DML: SELECT, INSERT, UPDATE, DELETE
- Advanced features: CTEs, window functions, JSON operations
- PostgreSQL-specific: inheritance, arrays, custom types

## Known Issues and Challenges

### 1. TypeName Handling
The `TypeName` AST node has known parsing complexities:
- Multiple representation formats in different contexts
- Array type specifications (`int4[]`)
- Custom type definitions
- Type modifiers and constraints

### 2. Diagnostic Errors
Current implementation has parsing errors across multiple sections:
- Expression handling (lines 1789, 1922, 1939, 2001)
- Statement generation methods
- Node deparsing logic
- Over 573 total parsing errors requiring resolution

### 3. Missing Dependencies
- `nested-obj` module not found in utils package
- Import resolution issues between packages
- Test runner type definitions incomplete

### 4. Environment Setup
- Native `libpg-query` build failures due to Python distutils
- Monorepo symlink dependencies not fully resolved
- TypeScript compilation blocked by import errors

## PostgreSQL 17 Upgrade Approach

### 1. Protocol Buffer Updates
The project uses `pg_query.proto` definitions that need updating for PG17:
- New AST node types for PG17 features
- Updated enum values and constants
- Modified field structures in existing nodes

### 2. Code Generation Pipeline
```bash
# Update protocol definitions
pg-proto-parser generate

# Regenerate TypeScript types
packages/types/scripts/pg-proto-parser.ts
packages/enums/scripts/pg-proto-parser.ts
packages/utils/scripts/pg-proto-parser.ts
```

### 3. Deparser Method Updates
For each new or modified AST node in PG17:
1. Add corresponding method to `Deparser` class
2. Handle new fields and properties
3. Update existing methods for field changes
4. Add comprehensive test coverage

### 4. Testing Strategy
- Expand fixture collection with PG17-specific SQL
- Update kitchen-sink tests for new syntax
- Validate round-trip parsing for all new features
- Performance testing for large AST trees

## Development Workflow

### 1. Environment Setup
```bash
# Install dependencies (requires Python distutils fix)
yarn install

# Build all packages using Lerna
yarn build

# For development builds with source maps
yarn build:dev

# Symlink workspace packages (automatically runs after install)
yarn symlink

# Clean all build artifacts
yarn clean
```

### 2. Running Tests
```bash
# Run all tests across all packages
yarn test

# Run tests for specific package
cd packages/deparser && yarn test

# Run tests in watch mode for development
cd packages/deparser && yarn test:watch

# Run linting across all packages
yarn lint

# Run specific test suites
cd packages/deparser && yarn test kitchen-sink.test.ts
cd packages/deparser && yarn test simple-usage.test.ts
cd packages/parser && yarn test kitchen-sink.test.ts
```

### 3. Package-Specific Commands
```bash
# Deparser package
cd packages/deparser
yarn build          # Build deparser
yarn test           # Run deparser tests
yarn test:watch     # Watch mode for development

# Parser package  
cd packages/parser
yarn build          # Build parser (includes native compilation)
yarn test           # Run parser tests

# Types package
cd packages/types
yarn build          # Generate and build type definitions

# Utils package
cd packages/utils
yarn build          # Build utility functions
yarn test           # Run utility tests
```

### 4. Adding New AST Node Support
1. **Identify Node Type**: Check `@pgsql/types` for new node definition
2. **Implement Handler**: Add method to `Deparser` class following naming convention
3. **Handle Context**: Consider different contexts (select, from, where, etc.)
4. **Add Tests**: Create fixtures and unit tests
5. **Validate**: Ensure round-trip parsing works correctly

Example workflow:
```bash
# 1. Build types first to get latest AST definitions
cd packages/types && yarn build

# 2. Build deparser with new handler method
cd packages/deparser && yarn build

# 3. Run tests to validate
cd packages/deparser && yarn test

# 4. Run kitchen-sink tests for comprehensive validation
yarn test kitchen-sink.test.ts
```

### 5. Debugging Approach
- Use `fail()` function for unhandled cases
- Leverage TypeScript types for compile-time validation
- Test with minimal SQL examples first
- Build up complexity incrementally

Debugging workflow:
```bash
# 1. Create minimal test case
echo "SELECT 1" > test.sql

# 2. Test parsing (requires parser package built)
cd packages/parser && node -e "
const { parse } = require('./dist');
const fs = require('fs');
const sql = fs.readFileSync('../test.sql', 'utf8');
console.log(JSON.stringify(parse(sql), null, 2));
"

# 3. Test deparsing
cd packages/deparser && node -e "
const { deparse } = require('./dist');
const { parse } = require('../parser/dist');
const fs = require('fs');
const sql = fs.readFileSync('../test.sql', 'utf8');
const ast = parse(sql);
console.log(deparse(ast));
"

# 4. Run specific tests
yarn test --testNamePattern="specific test name"
```

## Best Practices

### 1. Code Organization
- One method per AST node type
- Consistent naming: method name matches node type
- Use helper functions for common patterns
- Maintain context awareness throughout call stack

### 2. String Generation
- Build output arrays, join at end
- Use template literals for complex formatting
- Apply consistent spacing and formatting
- Handle optional clauses gracefully

### 3. Error Handling
- Fail fast on unrecognized node types
- Provide meaningful error messages
- Include node context in error reports
- Use TypeScript types to catch issues early

### 6. Testing Strategy
- Write tests before implementing new features
- Use snapshot testing for complex output
- Validate edge cases and error conditions
- Maintain comprehensive fixture coverage

Testing workflow:
```bash
# 1. Add SQL fixture
echo "CREATE TABLE test (id INT);" > __fixtures__/new_feature.sql

# 2. Run kitchen-sink test to generate baseline
cd packages/deparser && yarn test kitchen-sink.test.ts

# 3. Update snapshots if needed
cd packages/deparser && yarn test kitchen-sink.test.ts -u

# 4. Validate round-trip parsing
cd packages/deparser && yarn test simple-usage.test.ts

# 5. Run full test suite
yarn test
```

## Future Considerations

### 1. Performance Optimization
- Optimize string concatenation for large ASTs
- Cache frequently used formatting operations
- Consider streaming output for very large queries
- Profile memory usage patterns

### 2. Extensibility
- Plugin system for custom node types
- Configurable formatting options
- Support for PostgreSQL extensions
- Custom dialect support

### 3. Tooling Integration
- IDE support for AST manipulation
- Visual AST editors
- Query optimization tools
- Migration assistance utilities

## Conclusion

The PostgreSQL deparser represents a sophisticated system for converting AST representations back to valid SQL. The current implementation provides comprehensive coverage of PostgreSQL features but requires updates for PG17 compatibility. The modular architecture and extensive test suite provide a solid foundation for the upgrade process.

Key success factors for the PG17 upgrade:
1. Resolve current diagnostic errors and dependency issues
2. Update protocol buffer definitions and regenerate types
3. Systematically add support for new PG17 AST nodes
4. Maintain comprehensive test coverage throughout the process
5. Validate round-trip parsing for all supported features

The symmetric parsing/deparsing capability enables powerful SQL manipulation workflows and serves as a foundation for advanced PostgreSQL tooling and applications.
