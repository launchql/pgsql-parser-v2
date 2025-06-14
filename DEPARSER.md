# Deparser Development Notes

This document summarizes the current state of the PostgreSQL deparser and how to approach extending it for PostgreSQL 17.

## Getting Started

1. Install dependencies and build the packages (requires Node.js >=14 and Yarn):

   ```bash
   yarn
   yarn build
   ```

2. Run tests for the deparser package:

   ```bash
   cd packages/deparser
   yarn test:watch
   ```

The repository is a Lerna workspace, so each package (`parser`, `deparser`, `types`, `utils`) can be built and tested individually.

## Understanding the AST

AST nodes are *wrapped* – each node is an object whose key is the node type. For example a `ColumnDef` looks like:

```ts
{ ColumnDef: { colname: "id", typeName: { names: [...], typemod: -1 } } }
```

Type definitions and helper constructors are provided by the `@pgsql/utils` package. You can import all wrapped node interfaces from `@pgsql/utils/wrapped`.

## Existing Deparser

The new TypeScript deparser lives in `packages/deparser/src/deparser.ts`. It traverses the AST and converts each node to SQL. Utility helpers include:

- `ListUtils.unwrapList` – handles `List` wrappers from the parser
- `QuoteUtils` – quotes identifiers and literals
- `SqlFormatter` – minimal helper for formatting

`type-name-properties.json` lists AST properties that contain `TypeName` nodes. During visitation these properties are automatically unwrapped to avoid the double‐wrapping bug described in `packages/deparser/issues/typeName.md`.
`range-var-properties.json` performs the same role for `RangeVar` fields, ensuring inlined relations are handled consistently whether or not they are wrapped in a `RangeVar` object.

For reference, there is historical code in `packages/deparser/reference/deparser.ts` (PG13) and the PostgreSQL C implementation `packages/deparser/reference/postgres_deparse.c`. These show how PostgreSQL handles various node types.

## Tests

Unit tests for the deparser are located in `packages/deparser/__tests__`. The `create-table.test.ts` file contains many scenarios for `CREATE TABLE` statements. These tests are a good indicator of the required output and help reveal edge cases while implementing new node visitors.

## Building the New Deparser

1. **Start from the existing TypeScript implementation.** Add visitor methods for missing node types by referencing `postgres_deparse.c` to mirror PostgreSQL behaviour.
2. **Use wrapped types from `@pgsql/utils/wrapped`.** This ensures correct typing and helps avoid mistakes when accessing nested properties.
3. **Unwrap `TypeName` correctly.** Follow the hint in `typeName.md` – avoid producing `{ TypeName: { ... } }` in output trees. The mapping file `type-name-properties.json` lists which properties require unwrapping.
4. **Leverage utilities.** Always process `List` structures via `ListUtils.unwrapList` and quote identifiers with `QuoteUtils.quote`.
5. **Keep tests green.** Extend or add tests as new node types are handled. The test suite documents the expected SQL for each AST fragment.

By systematically porting logic from the C implementation and ensuring the structure of wrapped nodes matches that of the parser, the deparser can be upgraded to handle PostgreSQL 17 syntax accurately.
