# PostgreSQL Deparser for PG17: Architecture Analysis and Implementation Guide

## Executive Summary

This document provides a comprehensive analysis of the current PostgreSQL deparser implementation and outlines the approach for rebuilding it to support PostgreSQL 17 compatibility. The deparser is responsible for converting Abstract Syntax Trees (ASTs) back into SQL strings, enabling symmetric parsing and deparsing operations.

### Key Objectives
- Fix critical TypeName method signature error causing build failures
- Upgrade from PostgreSQL 13 to PostgreSQL 17 compatibility
- Improve node unwrapping and visitor pattern architecture
- Enhance test coverage and maintainability
- Provide comprehensive documentation for future development

### Current Status
- **Build Status**: Failing due to TypeName property access error
- **PostgreSQL Version**: Transitioning from PG13 to PG17
- **Architecture**: Visitor pattern with wrapped and unwrapped node types
- **Test Coverage**: Basic CREATE TABLE statements implemented

## Current Architecture Analysis

### Visitor Pattern Implementation

The current deparser uses a visitor pattern implemented in `packages/deparser/src/deparser.ts`. The core architecture consists of:

```typescript
export class Deparser implements DeparserVisitor {
  private formatter: SqlFormatter;
  private tree: Node[];

  visit(node: Node, context: DeparserContext = {}): string {
    const nodeType = this.getNodeType(node);
    const nodeData = this.getNodeData(node);
    
    if (this[nodeType]) {
      return this[nodeType](node, context);
    }
    
    throw new Error(`Unsupported node type: ${nodeType}`);
  }

  getNodeType(node: Node): string {
    return Object.keys(node)[0];
  }

  getNodeData(node: Node): any {
    const type = this.getNodeType(node);
    return (node as any)[type];
  }
}
```

### Key Components

1. **SqlFormatter**: Handles SQL formatting with configurable newlines and tabs
2. **QuoteUtils**: Manages identifier quoting and escaping
3. **ListUtils**: Utilities for unwrapping and processing node lists
4. **DeparserContext**: Context object passed through visitor methods
5. **Wrapped Node Types**: Type definitions from `@pgsql/utils/wrapped`

### Current Utility Classes

- **SqlFormatter**: Provides consistent SQL formatting
- **QuoteUtils**: Handles identifier quoting based on PostgreSQL rules
- **ListUtils**: Unwraps List nodes and processes arrays
- **DeparserVisitor**: Interface defining visitor method signatures

## Key Issues Identified

### 1. TypeName Method Signature Error (Critical)

**Problem**: The current TypeName method has incorrect property access:

```typescript
TypeName(node: t.TypeName['TypeName'], context: DeparserContext): string {
  // ERROR: Property 'TypeName' does not exist on type 'TypeName'
```

**Root Cause**: The TypeName interface in `@pgsql/utils/wrapped` is **unwrapped** and defined as:

```typescript
export interface TypeName {
  names?: Node[];
  typeOid?: number;
  setof?: boolean;
  pct_type?: boolean;
  typmods?: Node[];
  typemod?: number;
  arrayBounds?: Node[];
  location?: number;
}
```

**Expected AST Structure** (from tests):
```typescript
typeName: {
  names: [{ String: { sval: 'text' } }],
  typemod: -1
}
```

**Current Incorrect Method Signature**:
```typescript
TypeName(node: t.TypeName['TypeName'], context: DeparserContext): string {
  // Tries to access non-existent 'TypeName' property
```

**Correct Method Signature**:
```typescript
TypeName(node: t.TypeName, context: DeparserContext): string {
  if (!node.names) {
    return '';
  }
  // Access node.names directly since TypeName is unwrapped
```

### 2. Wrapped vs Unwrapped Node Pattern Understanding

The codebase uses both wrapped and unwrapped node patterns:

**Wrapped Node Example** (ColumnRef):
```typescript
export interface ColumnRef {
  ColumnRef: {
    fields?: Node[];
    location?: number;
  };
}

// Deparser method signature:
ColumnRef(node: t.ColumnRef['ColumnRef'], context: DeparserContext): string {
  const fields = ListUtils.unwrapList(node.fields);
  // ...
}
```

**Unwrapped Node Example** (TypeName):
```typescript
export interface TypeName {
  names?: Node[];
  typemod?: number;
  arrayBounds?: Node[];
  location?: number;
}

// Correct deparser method signature:
TypeName(node: t.TypeName, context: DeparserContext): string {
  if (!node.names) {
    return '';
  }
  // Access properties directly
}
```

### 3. Node Extraction in Visitor Pattern

The current visitor pattern uses `getNodeType()` and `getNodeData()` methods to extract node information:

```typescript
getNodeType(node: Node): string {
  return Object.keys(node)[0];
}

getNodeData(node: Node): any {
  const type = this.getNodeType(node);
  return (node as any)[type];
}
```

For wrapped nodes like ColumnRef, this extracts the inner data. For unwrapped nodes like TypeName, the node itself contains the data directly.

### 4. PostgreSQL 17 Compatibility Gaps

Comparison with the C reference implementation (`postgres_deparse.c`, 11,499 lines) reveals several areas needing updates:

- New AST node types introduced in PG17
- Updated constraint handling
- Enhanced expression parsing
- New JSON and XML functionality
- Updated function call syntax

## Reference Materials Analysis

### PostgreSQL C Implementation (`postgres_deparse.c`)

The C reference implementation provides comprehensive patterns for:

**Key Functions**:
- `deparseStringLiteral()`: String escaping and quoting
- `isReservedKeyword()`: Keyword detection for quoting
- `deparseAnyName()`: Name list processing
- `deparseExpr()`: Expression handling
- `deparseTypeName()`: Type name processing

**Context Handling**:
```c
typedef enum DeparseNodeContext {
  DEPARSE_NODE_CONTEXT_NONE,
  DEPARSE_NODE_CONTEXT_INSERT_RELATION,
  DEPARSE_NODE_CONTEXT_A_EXPR,
  DEPARSE_NODE_CONTEXT_CREATE_TYPE,
  DEPARSE_NODE_CONTEXT_ALTER_TYPE,
  DEPARSE_NODE_CONTEXT_SET_STATEMENT,
  DEPARSE_NODE_CONTEXT_FUNC_EXPR,
  DEPARSE_NODE_CONTEXT_IDENTIFIER,
  DEPARSE_NODE_CONTEXT_CONSTANT
} DeparseNodeContext;
```

### Legacy PG13 Implementation (`reference/deparser.ts`)

The old implementation (4,221 lines) provides insights into:

- Function-based approach vs. class-based visitor pattern
- Direct property access without proper unwrapping
- Extensive use of utility functions for formatting
- Complex type modification handling

**Key Patterns**:
```typescript
function deparse(node, context) {
  if (node.TypeName) {
    return deparseTypeName(node.TypeName);
  }
  // ... other node types
}
```

### Wrapped Node Types (`@pgsql/utils/wrapped`)

The wrapped types (2,484 lines) define the complete AST structure with both wrapped and unwrapped patterns:

```typescript
export type Node = ParseResult | ScanResult | Integer | Float | Boolean | 
  String | BitString | List | OidList | IntList | A_Const | Alias | 
  RangeVar | TableFunc | IntoClause | Var | Param | Aggref | /* ... */;

// Unwrapped interface
export interface TypeName {
  names?: Node[];
  typemod?: number;
  arrayBounds?: Node[];
  location?: number;
}

// Wrapped interface
export interface ColumnRef {
  ColumnRef: {
    fields?: Node[];
    location?: number;
  };
}
```

## Test Requirements Analysis

### Current Test Structure (`create-table.test.ts`)

The tests define expected behavior for CREATE TABLE statements:

```typescript
describe('CREATE TABLE statements', () => {
  it('should deparse simple CREATE TABLE', () => {
    const ast = {
      RawStmt: {
        stmt: {
          CreateStmt: {
            relation: {
              RangeVar: {
                relname: 'users',
                inh: true,
                relpersistence: 'p'
              }
            },
            tableElts: [
              {
                ColumnDef: {
                  colname: 'id',
                  typeName: {
                    names: [{ String: { sval: 'int4' } }],
                    typemod: -1
                  }
                }
              }
            ]
          }
        }
      }
    };
    
    const result = Deparser.deparse(ast);
    expect(result).toBe('CREATE TABLE users (id int4)');
  });
});
```

This test confirms that TypeName nodes are passed as direct objects with `names` and `typemod` properties, not wrapped in a `TypeName` property.

### Test Coverage Areas

1. **Basic CREATE TABLE**: Simple table creation
2. **IF NOT EXISTS**: Conditional creation
3. **TEMPORARY TABLE**: Temporary table handling
4. **Schema-qualified names**: Schema.table syntax
5. **Constraints**: PRIMARY KEY, NOT NULL, CHECK, UNIQUE
6. **DEFAULT values**: Integer, string, boolean defaults
7. **Data types**: Various PostgreSQL data types with modifiers
8. **Table-level constraints**: Composite keys, table checks

## Proposed Architecture

### 1. TypeName Method Fix

**Current Problem**:
```typescript
TypeName(node: t.TypeName['TypeName'], context: DeparserContext): string {
  // Incorrect property access - TypeName interface is unwrapped
}
```

**Proposed Solution**:
```typescript
TypeName(node: t.TypeName, context: DeparserContext): string {
  if (!node.names) {
    return '';
  }
  
  const names = node.names.map((name: any) => {
    if (name.String) {
      return name.String.sval || name.String.str;
    }
    return this.visit(name, context);
  }).join('.');
  
  // Handle type modifiers
  if (node.typemod && node.typemod !== -1) {
    const mods = this.formatTypeMods(node.typemod);
    return `${names}${mods}`;
  }
  
  return names;
}
```

### 2. Enhanced Visitor Pattern

**Improved Node Processing**:
```typescript
visit(node: Node, context: DeparserContext = {}): string {
  if (node == null) {
    return '';
  }
  
  const nodeType = this.getNodeType(node);
  
  // Enhanced error handling
  if (!this[nodeType]) {
    throw new Error(`Unsupported node type: ${nodeType}. Available methods: ${Object.getOwnPropertyNames(this).filter(name => typeof this[name] === 'function').join(', ')}`);
  }
  
  try {
    return this[nodeType](node, context);
  } catch (error) {
    throw new Error(`Error processing ${nodeType}: ${error.message}`);
  }
}

getNodeType(node: Node): string {
  if (typeof node === 'object' && node !== null) {
    const keys = Object.keys(node);
    if (keys.length === 1) {
      return keys[0];
    }
  }
  throw new Error(`Invalid node structure: ${JSON.stringify(node)}`);
}
```

### 3. Wrapped vs Unwrapped Node Handling

**Pattern Recognition**:
```typescript
// For wrapped nodes (like ColumnRef), extract inner data
ColumnRef(node: t.ColumnRef['ColumnRef'], context: DeparserContext): string {
  // node already contains the inner ColumnRef data
  const fields = ListUtils.unwrapList(node.fields);
  // ...
}

// For unwrapped nodes (like TypeName), use node directly
TypeName(node: t.TypeName, context: DeparserContext): string {
  // node directly contains TypeName properties
  if (!node.names) {
    return '';
  }
  // ...
}
```

### 4. Context Enhancement

**Expanded Context System**:
```typescript
export interface DeparserContext {
  // Current context
  parentNode?: string;
  parentField?: string;
  
  // New context enhancements
  indentLevel?: number;
  inSubquery?: boolean;
  inConstraint?: boolean;
  inExpression?: boolean;
  
  // PostgreSQL 17 specific
  jsonFormatting?: boolean;
  xmlFormatting?: boolean;
  partitionContext?: boolean;
}
```

### 5. Utility Function Organization

**Enhanced QuoteUtils**:
```typescript
export class QuoteUtils {
  static quote(identifier: string): string {
    if (!identifier) return '';
    
    // Check if quoting is needed
    if (this.needsQuoting(identifier)) {
      return `"${identifier.replace(/"/g, '""')}"`;
    }
    
    return identifier;
  }
  
  private static needsQuoting(identifier: string): boolean {
    // PostgreSQL identifier rules
    if (!/^[a-z_][a-z0-9_$]*$/.test(identifier)) {
      return true;
    }
    
    // Check reserved keywords
    return RESERVED_KEYWORDS.has(identifier.toLowerCase());
  }
}
```

**Enhanced ListUtils**:
```typescript
export class ListUtils {
  static unwrapList(listNode: any): any[] {
    if (!listNode) return [];
    
    if (listNode.List) {
      return listNode.List.items || [];
    }
    
    if (Array.isArray(listNode)) {
      return listNode;
    }
    
    return [listNode];
  }
  
  static processNodeList(nodes: any[], visitor: (node: any) => string): string[] {
    return this.unwrapList(nodes).map(visitor);
  }
}
```

## Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)

1. **Fix TypeName Method Signature**
   - Update TypeName method to use correct unwrapped signature
   - Remove incorrect property access attempt
   - Test with existing CREATE TABLE tests

2. **Node Type Pattern Audit**
   - Review all visitor methods for correct wrapped/unwrapped patterns
   - Identify other methods with similar signature issues
   - Implement consistent pattern recognition

3. **Basic Test Validation**
   - Ensure all existing tests pass
   - Fix any regression issues
   - Validate CREATE TABLE functionality

### Phase 2: PostgreSQL 17 Compatibility (Week 2-3)

1. **AST Structure Updates**
   - Compare PG13 vs PG17 AST differences
   - Update node type definitions
   - Handle new node types

2. **Expression Handling Enhancement**
   - Update A_Expr processing
   - Enhance operator handling
   - Improve function call processing

3. **Constraint System Updates**
   - Update constraint processing
   - Handle new constraint types
   - Improve constraint validation

### Phase 3: Feature Completeness (Week 4-5)

1. **Statement Coverage Expansion**
   - Implement missing statement types
   - Add comprehensive DDL support
   - Enhance DML statement handling

2. **Advanced Features**
   - JSON/XML expression support
   - Partition table handling
   - Advanced indexing features

3. **Performance Optimization**
   - Optimize visitor pattern performance
   - Reduce memory allocation
   - Improve string concatenation

### Phase 4: Testing and Documentation (Week 6)

1. **Comprehensive Test Suite**
   - Add tests for all statement types
   - Include edge case testing
   - Performance benchmarking

2. **Documentation Updates**
   - API documentation
   - Usage examples
   - Migration guide

3. **Integration Testing**
   - End-to-end testing
   - Compatibility validation
   - Regression testing

## Testing Strategy

### 1. Unit Testing Approach

**Test Structure**:
```typescript
describe('Deparser', () => {
  describe('TypeName handling', () => {
    it('should handle simple type names', () => {
      const ast = {
        TypeName: {
          names: [{ String: { sval: 'int4' } }],
          typemod: -1
        }
      };
      
      const deparser = new Deparser([]);
      const result = deparser.TypeName(ast, {});
      expect(result).toBe('int4');
    });
    
    it('should handle type modifiers', () => {
      const ast = {
        TypeName: {
          names: [{ String: { sval: 'varchar' } }],
          typemod: 104 // varchar(100)
        }
      };
      
      const deparser = new Deparser([]);
      const result = deparser.TypeName(ast, {});
      expect(result).toBe('varchar(100)');
    });
  });
});
```

### 2. Integration Testing

**Round-trip Testing**:
```typescript
describe('Round-trip testing', () => {
  it('should parse and deparse identically', () => {
    const sql = 'CREATE TABLE users (id int4, name text)';
    const ast = parse(sql);
    const deparsed = Deparser.deparse(ast);
    expect(deparsed).toBe(sql);
  });
});
```

### 3. Regression Testing

- Maintain test suite for all supported SQL constructs
- Automated testing against PostgreSQL 17 parser output
- Performance regression detection

### 4. Compatibility Testing

- Test against real PostgreSQL 17 installations
- Validate against pg_dump output
- Cross-version compatibility checks

## Implementation Checklist

### Critical Fixes
- [ ] Fix TypeName method signature (`t.TypeName['TypeName']` → `t.TypeName`)
- [ ] Audit all visitor methods for correct wrapped/unwrapped patterns
- [ ] Update method signatures consistently
- [ ] Add comprehensive error handling

### PostgreSQL 17 Compatibility
- [ ] Audit AST structure changes from PG13 to PG17
- [ ] Update constraint handling for new constraint types
- [ ] Implement new expression types and operators
- [ ] Add support for new JSON/XML functionality
- [ ] Handle partition table syntax updates

### Architecture Improvements
- [ ] Enhance context passing mechanism
- [ ] Improve utility function organization
- [ ] Optimize visitor pattern performance
- [ ] Add comprehensive logging and debugging

### Testing Enhancement
- [ ] Expand test coverage to all statement types
- [ ] Add edge case and error condition testing
- [ ] Implement round-trip testing framework
- [ ] Add performance benchmarking

### Documentation
- [ ] Update API documentation
- [ ] Create usage examples and tutorials
- [ ] Document migration from PG13 to PG17
- [ ] Provide troubleshooting guide

## Verification Strategy

### Code Quality Checks
1. **TypeScript Compilation**: Ensure all type errors are resolved
2. **Linting**: Follow project coding standards
3. **Test Coverage**: Maintain >90% test coverage
4. **Performance**: Benchmark against previous versions

### Functional Validation
1. **Test Suite**: All tests must pass
2. **Round-trip Testing**: Parse → Deparse → Parse consistency
3. **PostgreSQL Compatibility**: Validate against actual PostgreSQL 17
4. **Regression Testing**: Ensure no functionality loss

### Integration Validation
1. **Build System**: Successful compilation and packaging
2. **Dependency Management**: Proper package integration
3. **API Compatibility**: Maintain backward compatibility where possible
4. **Documentation Accuracy**: All examples must work

## Conclusion

The PostgreSQL deparser rebuild for PG17 compatibility requires systematic addressing of the TypeName method signature error, comprehensive understanding of wrapped vs unwrapped node patterns, and careful migration from the PG13 architecture. The proposed approach leverages the existing visitor pattern while enhancing it with proper error handling, improved context management, and comprehensive testing.

The key insight is that TypeName is an unwrapped interface, meaning the method signature should be `TypeName(node: t.TypeName, context: DeparserContext)` rather than attempting to access a non-existent wrapper property. This pattern recognition is crucial for correctly handling all node types in the deparser.

The implementation roadmap provides a structured approach to delivering a robust, maintainable, and fully compatible PG17 deparser that serves as the foundation for symmetric SQL parsing and deparsing operations.

### Next Steps

1. Begin with Phase 1 critical fixes, focusing on the TypeName method signature
2. Establish comprehensive testing framework early
3. Maintain close alignment with PostgreSQL 17 C implementation patterns
4. Ensure thorough documentation throughout the development process

This document serves as both a technical specification and implementation guide for the deparser rebuild project, providing the necessary context and direction for successful completion with accurate understanding of the wrapped vs unwrapped node type patterns.
