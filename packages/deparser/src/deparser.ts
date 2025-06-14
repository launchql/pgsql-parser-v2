import { Node } from '@pgsql/types';
import { SqlFormatter } from './utils/sql-formatter';
import { DeparserContext, DeparserVisitor } from './visitors/base';
import { QuoteUtils } from './utils/quote-utils';
import { ListUtils } from './utils/list-utils';
import typeNameProperties from './type-name-properties.json';
import rangeVarProperties from './range-var-properties.json';
import * as t from '@pgsql/utils/wrapped';
export interface DeparserOptions {
  newline?: string;
  tab?: string;
}

export class Deparser implements DeparserVisitor {
  private formatter: SqlFormatter;
  private tree: Node[];

  constructor(tree: Node | Node[] | { version: number; stmts: Node[] }, opts: DeparserOptions = {}) {
    this.formatter = new SqlFormatter(opts.newline, opts.tab);
    if (!Array.isArray(tree) && (tree as any)?.version !== undefined && Array.isArray((tree as any).stmts)) {
      this.tree = (tree as any).stmts as Node[];
    } else {
      this.tree = Array.isArray(tree) ? tree : [tree as Node];
    }
  }

  static deparse(query: Node | Node[], opts: DeparserOptions = {}): string {
    return new Deparser(query, opts).deparseQuery();
  }

  deparseQuery(): string {
    return this.tree
      .map(node => this.deparse(node))
      .join(this.formatter.newline() + this.formatter.newline());
  }

  deparse(node: Node, context: DeparserContext = {}): string | null {
    if (node == null) {
      return null;
    }

    if (typeof node === 'number' || node instanceof Number) {
      return node.toString();
    }

    try {
      return this.visit(node, context);
    } catch (error) {
      const nodeType = Object.keys(node)[0];
      throw new Error(`Error deparsing ${nodeType}: ${(error as Error).message}`);
    }
  }

  visit(node: Node, context: DeparserContext = {}): string {
    const nodeType = this.getNodeType(node);
    const nodeData = this.getNodeData(node);

    // Check if this node has TypeName properties that should be unwrapped
    const typeNameProps = (typeNameProperties as any)[nodeType];
    if (typeNameProps) {
      for (const propName of typeNameProps) {
        if (nodeData[propName]) {
          const typeName = nodeData[propName];
          if (typeName.TypeName) {
            // If it's wrapped in a TypeName object, unwrap it
            nodeData[propName] = typeName.TypeName;
          }
        }
      }
    }

    // Unwrap RangeVar properties when they appear wrapped
    const rangeProps = (rangeVarProperties as any)[nodeType];
    if (rangeProps) {
      for (const propName of rangeProps) {
        if (nodeData[propName]) {
          const value = nodeData[propName];
          if (Array.isArray(value)) {
            nodeData[propName] = value.map(v => (v && (v as any).RangeVar) ? v.RangeVar : v);
          } else if (value.RangeVar) {
            nodeData[propName] = value.RangeVar;
          }
        }
      }
    }

    const methodName = nodeType as keyof this;
    if (typeof this[methodName] === 'function') {
      return (this[methodName] as any)(nodeData, context);
    }
    
    throw new Error(`Deparser does not handle node type: ${nodeType}`);
  }

  getNodeType(node: Node): string {
    if (this.isRangeVar(node)) {
      return 'RangeVar';
    }

    if (
      node &&
      typeof node === 'object' &&
      'stmt' in (node as any)
    ) {
      return 'RawStmt';
    }

    return Object.keys(node)[0];
  }

  getNodeData(node: Node): any {
    const type = this.getNodeType(node);
    if (type === 'RangeVar' && !(node as any).RangeVar) {
      return node;
    }
    if (type === 'RawStmt' && !(node as any).RawStmt) {
      return node;
    }
    return (node as any)[type];
  }

  private isRangeVar(node: any): boolean {
    return (
      node &&
      typeof node === 'object' &&
      'relname' in node &&
      typeof (node as any).relname === 'string'
    );
  }

  RawStmt(node: t.RawStmt['RawStmt'], context: DeparserContext): string {
    if (node.stmt_len) {
      return this.deparse(node.stmt, context) + ';';
    }
    return this.deparse(node.stmt, context);
  }

  SelectStmt(node: t.SelectStmt['SelectStmt'], context: DeparserContext): string {
    const output: string[] = [];

    if (node && node.withClause) {
      output.push(this.visit(node.withClause, context));
    }

    if (node && (!node.op || node.op === 'SETOP_NONE')) {
      if (node.valuesLists == null) {
        output.push('SELECT');
      }
    } else if (node && node.op) {
      output.push(this.formatter.parens(this.SelectStmt(node.larg as t.SelectStmt['SelectStmt'], context)));

      switch (node.op) {
        case 'SETOP_NONE':
          output.push('NONE');
          break;
        case 'SETOP_UNION':
          output.push('UNION');
          break;
        case 'SETOP_INTERSECT':
          output.push('INTERSECT');
          break;
        case 'SETOP_EXCEPT':
          output.push('EXCEPT');
          break;
        default:
          throw new Error(`Bad SelectStmt op: ${node.op}`);
      }

      if (node && node.all) {
        output.push('ALL');
      }

      if (node) {
        output.push(this.formatter.parens(this.SelectStmt(node.rarg as t.SelectStmt['SelectStmt'], context)));
      }
    }

    if (node && node.distinctClause) {
      const distinctClause = ListUtils.unwrapList(node.distinctClause);
      if (distinctClause.length > 0 && Object.keys(distinctClause[0]).length > 0) {
        output.push('DISTINCT ON');
        const clause = distinctClause
          .map(e => this.visit(e, { ...context, select: true }))
          .join(`, ${this.formatter.newline()}`);
        output.push(this.formatter.parens(clause));
      } else {
        output.push('DISTINCT');
      }
    }

    if (node && node.targetList) {
      const targetList = ListUtils.unwrapList(node.targetList);
      const targets = targetList
        .map(e => this.visit(e, { ...context, select: true }))
        .join(`, ${this.formatter.newline()}`);
      output.push(this.formatter.indent(targets));
    }

    if (node && node.intoClause) {
      output.push('INTO');
      output.push(this.formatter.indent(this.visit(node.intoClause, context)));
    }

    if (node && node.fromClause) {
      output.push('FROM');
      const fromList = ListUtils.unwrapList(node.fromClause);
      const fromItems = fromList
        .map(e => this.deparse(e, { ...context, from: true }))
        .join(`, ${this.formatter.newline()}`);
      output.push(this.formatter.indent(fromItems));
    }

    if (node && node.whereClause) {
      output.push('WHERE');
      output.push(this.formatter.indent(this.visit(node.whereClause, context)));
    }

    if (node && node.valuesLists) {
      output.push('VALUES');
      const lists = ListUtils.unwrapList(node.valuesLists).map(list => {
        const values = ListUtils.unwrapList(list).map(val => this.visit(val, context));
        return this.formatter.parens(values.join(', '));
      });
      output.push(lists.join(', '));
    }

    if (node && node.groupClause) {
      output.push('GROUP BY');
      const groupList = ListUtils.unwrapList(node.groupClause);
      const groupItems = groupList
        .map(e => this.visit(e, { ...context, group: true }))
        .join(`, ${this.formatter.newline()}`);
      output.push(this.formatter.indent(groupItems));
    }

    if (node && node.havingClause) {
      output.push('HAVING');
      output.push(this.formatter.indent(this.visit(node.havingClause, context)));
    }

    if (node && node.sortClause) {
      output.push('ORDER BY');
      const sortList = ListUtils.unwrapList(node.sortClause);
      const sortItems = sortList
        .map(e => this.visit(e, { ...context, sort: true }))
        .join(`, ${this.formatter.newline()}`);
      output.push(this.formatter.indent(sortItems));
    }

    if (node && node.limitCount) {
      output.push('LIMIT');
      output.push(this.formatter.indent(this.visit(node.limitCount, context)));
    }

    if (node && node.limitOffset) {
      output.push('OFFSET');
      output.push(this.formatter.indent(this.visit(node.limitOffset, context)));
    }

    return output.join(' ');
  }

  A_Expr(node: t.A_Expr['A_Expr'], context: DeparserContext): string {
    const kind = node.kind as string;
    const name = ListUtils.unwrapList(node.name);
    const lexpr = node.lexpr;
    const rexpr = node.rexpr;

    switch (kind) {
      case 'AEXPR_OP':
        if (lexpr && rexpr) {
          return this.formatter.format([
            this.visit(lexpr, context),
            this.deparseOperatorName(name),
            this.visit(rexpr, context)
          ]);
        } else if (rexpr) {
          return this.formatter.format([
            this.deparseOperatorName(name),
            this.visit(rexpr, context)
          ]);
        }
        break;
      case 'AEXPR_OP_ANY':
        return this.formatter.format([
          this.visit(lexpr, context),
          this.deparseOperatorName(name),
          'ANY',
          this.formatter.parens(this.visit(rexpr, context))
        ]);
      case 'AEXPR_OP_ALL':
        return this.formatter.format([
          this.visit(lexpr, context),
          this.deparseOperatorName(name),
          'ALL',
          this.formatter.parens(this.visit(rexpr, context))
        ]);
      case 'AEXPR_DISTINCT':
        return this.formatter.format([
          this.visit(lexpr, context),
          'IS DISTINCT FROM',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_NOT_DISTINCT':
        return this.formatter.format([
          this.visit(lexpr, context),
          'IS NOT DISTINCT FROM',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_NULLIF':
        return this.formatter.format([
          'NULLIF',
          this.formatter.parens([
            this.visit(lexpr, context),
            this.visit(rexpr, context)
          ].join(', '))
        ]);
      case 'AEXPR_IN':
        return this.formatter.format([
          this.visit(lexpr, context),
          'IN',
          this.formatter.parens(this.visit(rexpr, context))
        ]);
      case 'AEXPR_LIKE':
        return this.formatter.format([
          this.visit(lexpr, context),
          'LIKE',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_ILIKE':
        return this.formatter.format([
          this.visit(lexpr, context),
          'ILIKE',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_SIMILAR':
        return this.formatter.format([
          this.visit(lexpr, context),
          'SIMILAR TO',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_BETWEEN':
        return this.formatter.format([
          this.visit(lexpr, context),
          'BETWEEN',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_NOT_BETWEEN':
        return this.formatter.format([
          this.visit(lexpr, context),
          'NOT BETWEEN',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_BETWEEN_SYM':
        return this.formatter.format([
          this.visit(lexpr, context),
          'BETWEEN SYMMETRIC',
          this.visit(rexpr, context)
        ]);
      case 'AEXPR_NOT_BETWEEN_SYM':
        return this.formatter.format([
          this.visit(lexpr, context),
          'NOT BETWEEN SYMMETRIC',
          this.visit(rexpr, context)
        ]);
    }

    throw new Error(`Unhandled A_Expr kind: ${kind}`);
  }

  deparseOperatorName(name: t.Node[]): string {
    if (!name || name.length === 0) {
      return '';
    }
    
    return name.map((n: any) => {
      if (n.String) {
        return n.String.sval || n.String.str;
      }
      return this.visit(n, {});
    }).join('.');
  }

  InsertStmt(node: t.InsertStmt['InsertStmt'], context: DeparserContext): string {
    const output: string[] = [];

    if (node && node.withClause) {
      output.push(this.visit(node.withClause, context));
    }

    output.push('INSERT INTO');
    if (node && node.relation) {
      output.push(this.deparse(node.relation, context));
    }

    if (node && node.cols) {
      const cols = ListUtils.unwrapList(node.cols);
      if (cols && cols.length) {
        const colNames = cols.map(col => this.visit(col, context));
        output.push(this.formatter.parens(colNames.join(', ')));
      }
    }

    if (node && node.selectStmt) {
      output.push(this.deparse(node.selectStmt, context));
    } else {
      output.push('DEFAULT VALUES');
    }

    if (node.onConflictClause) {
      const clause = node.onConflictClause as any;
      output.push('ON CONFLICT');

      if (clause.infer?.indexElems) {
        const indexElems = ListUtils.unwrapList(clause.infer.indexElems);
        const elemStrs = indexElems.map(elem => this.visit(elem, context));
        output.push(this.formatter.parens(elemStrs.join(', ')));
      } else if (clause.infer?.conname) {
        output.push('ON CONSTRAINT');
        output.push(clause.infer.conname);
      }

      switch (clause.action as string) {
        case 'ONCONFLICT_NOTHING':
          output.push('DO NOTHING');
          break;
        case 'ONCONFLICT_UPDATE':
          output.push('DO');
          output.push(this.UpdateStmt(clause as unknown as t.UpdateStmt['UpdateStmt'], context));
          break;
        default:
          throw new Error('Unhandled CONFLICT CLAUSE');
      }
    }

    if (node.returningList) {
      output.push('RETURNING');
      output.push(this.deparseReturningList(node.returningList, context));
    }

    return output.join(' ');
  }

  UpdateStmt(node: t.UpdateStmt['UpdateStmt'], context: DeparserContext): string {
    const output: string[] = [];

    if (node.withClause) {
      output.push(this.visit(node.withClause, context));
    }

    output.push('UPDATE');
    if (node.relation) {
      output.push(this.deparse(node.relation, context));
    }
    output.push('SET');

    const targetList = ListUtils.unwrapList(node.targetList);
    if (targetList && targetList.length) {
      const firstTarget = targetList[0];
      if (firstTarget.val?.MultiAssignRef) {
        const names = targetList.map(target => target.name);
        output.push(this.formatter.parens(names.join(',')));
        output.push('=');
        output.push(this.visit(firstTarget.val, context));
      } else {
        const assignments = targetList.map(target => 
          this.visit(target, { ...context, update: true })
        );
        output.push(assignments.join(','));
      }
    }

    if (node.fromClause) {
      output.push('FROM');
      const fromList = ListUtils.unwrapList(node.fromClause);
      const fromItems = fromList.map(item => this.deparse(item, context));
      output.push(fromItems.join(', '));
    }

    if (node.whereClause) {
      output.push('WHERE');
      output.push(this.visit(node.whereClause, context));
    }

    if (node.returningList) {
      output.push('RETURNING');
      output.push(this.deparseReturningList(node.returningList, context));
    }

    return output.join(' ');
  }

  DeleteStmt(node: t.DeleteStmt['DeleteStmt'], context: DeparserContext): string {
    const output: string[] = [];

    if (node.withClause) {
      output.push(this.visit(node.withClause, context));
    }

    output.push('DELETE');
    output.push('FROM');
    output.push(this.deparse(node.relation, context));

    if (node.usingClause) {
      output.push('USING');
      const usingList = ListUtils.unwrapList(node.usingClause);
      const usingItems = usingList.map(item => this.deparse(item, context));
      output.push(usingItems.join(', '));
    }

    if (node.whereClause) {
      output.push('WHERE');
      output.push(this.visit(node.whereClause, context));
    }

    if (node.returningList) {
      output.push('RETURNING');
      output.push(this.deparseReturningList(node.returningList, context));
    }

    return output.join(' ');
  }

  WithClause(node: t.WithClause['WithClause'], context: DeparserContext): string {
    const output: string[] = ['WITH'];
    
    if (node.recursive) {
      output.push('RECURSIVE');
    }
    
    const ctes = ListUtils.unwrapList(node.ctes);
    const cteStrs = ctes.map(cte => this.visit(cte, context));
    output.push(cteStrs.join(', '));
    
    return output.join(' ');
  }

  ResTarget(node: t.ResTarget['ResTarget'], context: DeparserContext): string {
    const output: string[] = [];
    
    if (context.update && node.name) {
      output.push(QuoteUtils.quote(node.name));
      output.push('=');
      if (node.val) {
        output.push(this.deparse(node.val, context));
      }
    } else {
      if (node.val) {
        output.push(this.deparse(node.val, context));
      }
      
      if (node.name) {
        output.push('AS');
        output.push(QuoteUtils.quote(node.name));
      }
    }
    
    return output.join(' ');
  }

  deparseReturningList(list: t.Node[], context: DeparserContext): string {
    return ListUtils.unwrapList(list)
      .map(returning => {
        const val = this.visit(returning.val, context);
        const alias = returning.name ? ` AS ${QuoteUtils.quote(returning.name)}` : '';
        return val + alias;
      })
      .join(',');
  }

  BoolExpr(node: t.BoolExpr['BoolExpr'], context: DeparserContext): string {
    const boolop = node.boolop as string;
    const args = ListUtils.unwrapList(node.args);
    
    let formatStr = '%s';
    if (context.bool) {
      formatStr = '(%s)';
    }
    
    const boolContext = { ...context, bool: true };

    switch (boolop) {
      case 'AND_EXPR':
        const andArgs = args.map(arg => this.visit(arg, boolContext)).join(' AND ');
        return formatStr.replace('%s', andArgs);
      case 'OR_EXPR':
        const orArgs = args.map(arg => this.visit(arg, boolContext)).join(' OR ');
        return formatStr.replace('%s', orArgs);
      case 'NOT_EXPR':
        return `NOT (${this.visit(args[0], context)})`;
      default:
        throw new Error(`Unhandled BoolExpr boolop: ${boolop}`);
    }
  }

  FuncCall(node: t.FuncCall['FuncCall'], context: DeparserContext): string {
    const funcname = ListUtils.unwrapList(node.funcname);
    const args = ListUtils.unwrapList(node.args);
    const name = funcname.map(n => this.visit(n, context)).join('.');

    const params: string[] = [];
    
    if (node.agg_distinct) {
      params.push('DISTINCT');
    }
    
    if (node.agg_star) {
      params.push('*');
    } else {
      params.push(...args.map(arg => this.visit(arg, context)));
    }

    let result = `${name}(${params.join(', ')})`;

    if (node.agg_filter) {
      result += ` FILTER (WHERE ${this.visit(node.agg_filter, context)})`;
    }

    if (node.over) {
      result += ` OVER ${this.visit(node.over, context)}`;
    }

    return result;
  }

  A_Const(node: t.A_Const['A_Const'], context: DeparserContext): string {
    if (node.ival?.Integer?.ival !== undefined) {
      return node.ival.Integer.ival.toString();
    } else if (typeof node.ival === 'object' && 'ival' in node.ival) {
      return node.ival.ival.toString();
    } else if (node.ival && typeof node.ival === 'object' && Object.keys(node.ival).length === 0) {
      // libpg_query represents integer 0 as an empty object
      return '0';
    } else if (node.fval?.Float?.fval !== undefined) {
      return node.fval.Float.fval;
    } else if (node.sval?.String?.sval !== undefined) {
      return QuoteUtils.escape(node.sval.String.sval);
    } else if (typeof node.sval === 'object' && 'sval' in node.sval) {
      return QuoteUtils.escape(node.sval.sval as string);
    } else if (node.boolval?.Boolean?.boolval !== undefined) {
      return node.boolval.Boolean.boolval ? 'true' : 'false';
    } else if (typeof node.boolval === 'object' && 'boolval' in node.boolval) {
      // handle wrapped boolean without the Boolean tag
      return node.boolval.boolval ? 'true' : 'false';
    } else if (node.bsval?.BitString?.bsval !== undefined) {
      return node.bsval.BitString.bsval;
    } else if (node.isnull) {
      return 'NULL';
    }
    return 'NULL';
  }

  ColumnRef(node: t.ColumnRef['ColumnRef'], context: DeparserContext): string {
    const fields = ListUtils.unwrapList(node.fields);
    return fields.map(field => {
      if (field.String) {
        return QuoteUtils.quote(field.String.sval || field.String.str);
      } else if (field.A_Star) {
        return '*';
      }
      return this.visit(field, context);
    }).join('.');
  }

  TypeName(node: t.TypeName, context: DeparserContext): string {
    if (!node.names) {
      return '';
    }

    const names = node.names.map((name: any) => {
      if (name.String) {
        return name.String.sval || name.String.str;
      }
      return '';
    }).filter(Boolean);

    const catalog = names[0];
    const type = names[1];

    let args = node.typmods ? this.formatTypeMods(node.typmods, context) : null;

    if (!args && node.typemod != null && node.typemod !== -1) {
      const lastName = names[names.length - 1];

      if (lastName === 'numeric') {
        const tm = node.typemod - 4;
        const precision = tm >> 16;
        const scale = tm & 0xffff;
        args = `${precision},${scale}`;
      } else if (lastName === 'varchar' || lastName === 'bpchar' || lastName === 'char') {
        const length = node.typemod - 64;
        args = `${length}`;
      }
    }

    const mods = (name: string, size: string | null) => {
      if (size != null) {
        return `${name}(${size})`;
      }
      return name;
    };

    if (catalog === 'char' && !type) {
      return mods('"char"', args);
    }
    
    if (catalog === 'pg_catalog' && type === 'char') {
      return mods('pg_catalog."char"', args);
    }

    if (catalog !== 'pg_catalog') {
      const quotedNames = names.map((name: string) => QuoteUtils.quote(name));
      return mods(quotedNames.join('.'), args);
    }

    const pgTypeName = this.getPgCatalogTypeName(type, args);
    return mods(pgTypeName, args);
  }

  Alias(node: t.Alias['Alias'], context: DeparserContext): string {
    const name = node.aliasname;
    const output: string[] = ['AS'];

    if (node.colnames) {
      const colnames = ListUtils.unwrapList(node.colnames);
      const quotedColnames = colnames.map(col => {
        const colStr = this.deparse(col, context);
        return QuoteUtils.quote(colStr);
      });
      output.push(QuoteUtils.quote(name) + this.formatter.parens(quotedColnames.join(', ')));
    } else {
      output.push(QuoteUtils.quote(name));
    }

    return output.join(' ');
  }

  RangeVar(node: t.RangeVar, context: DeparserContext): string {
    let relation = '';

    if (node.schemaname) {
      relation += QuoteUtils.quote(node.schemaname) + '.';
    }
    relation += QuoteUtils.quote(node.relname);

    const parts: string[] = [relation];

    if (node.alias) {
      const aliasStr = this.deparse(node.alias, context);
      parts.push(aliasStr);
    }

    return parts.join(' ');
  }

  formatTypeMods(typmods: t.Node[], context: DeparserContext): string | null {
    if (!typmods || typmods.length === 0) {
      return null;
    }

    const mods = ListUtils.unwrapList(typmods);
    return mods.map(mod => {
      return this.deparse(mod, context);
    }).join(', ');
  }

  getPgCatalogTypeName(typeName: string, size: string | null): string {
    switch (typeName) {
      case 'bpchar':
        if (size != null) {
          return 'char';
        }
        return 'pg_catalog.bpchar';
      case 'varchar':
        return 'varchar';
      case 'numeric':
        return 'numeric';
      case 'bool':
        return 'boolean';
      case 'int2':
        return 'smallint';
      case 'int4':
        return 'int';
      case 'int8':
        return 'bigint';
      case 'real':
        return 'pg_catalog.float4';
      case 'time':
        return 'time';
      case 'timestamp':
        return 'timestamp';
      case 'interval':
        return 'interval';
      case 'bit':
        return 'bit';
      default:
        return `pg_catalog.${typeName}`;
    }
  }

  A_ArrayExpr(node: t.A_ArrayExpr['A_ArrayExpr'], context: DeparserContext): string {
    const elements = ListUtils.unwrapList(node.elements);
    const elementStrs = elements.map(el => this.visit(el, context));
    return `ARRAY[${elementStrs.join(', ')}]`;
  }

  A_Indices(node: t.A_Indices['A_Indices'], context: DeparserContext): string {
    if (node.lidx) {
      return `[${this.visit(node.lidx, context)}:${this.visit(node.uidx, context)}]`;
    }
    return `[${this.visit(node.uidx, context)}]`;
  }

  A_Indirection(node: t.A_Indirection['A_Indirection'], context: DeparserContext): string {
    const output = [this.visit(node.arg, context)];
    const indirection = ListUtils.unwrapList(node.indirection);
    
    for (const subnode of indirection) {
      if (subnode.String || subnode.A_Star) {
        const value = subnode.A_Star ? '*' : QuoteUtils.quote(subnode.String.sval || subnode.String.str);
        output.push(`.${value}`);
      } else {
        output.push(this.visit(subnode, context));
      }
    }
    
    return output.join('');
  }

  A_Star(node: t.A_Star['A_Star'], context: DeparserContext): string { 
    return '*'; 
  }

  CaseExpr(node: t.CaseExpr['CaseExpr'], context: DeparserContext): string {
    const output: string[] = ['CASE'];

    if (node.arg) {
      output.push(this.visit(node.arg, context));
    }

    const args = ListUtils.unwrapList(node.args);
    for (const arg of args) {
      output.push(this.visit(arg, context));
    }

    if (node.defresult) {
      output.push('ELSE');
      output.push(this.visit(node.defresult, context));
    }

    output.push('END');
    return output.join(' ');
  }

  CoalesceExpr(node: t.CoalesceExpr['CoalesceExpr'], context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    const argStrs = args.map(arg => this.visit(arg, context));
    return `COALESCE(${argStrs.join(', ')})`;
  }

  TypeCast(node: t.TypeCast['TypeCast'], context: DeparserContext): string {
    return this.formatter.format([
      this.visit(node.arg, context),
      '::',
      this.TypeName(node.typeName as t.TypeName, context)
    ]);
  }

  CollateClause(node: t.CollateClause['CollateClause'], context: DeparserContext): string {
    const output: string[] = [];
    
    if (node.arg) {
      output.push(this.visit(node.arg, context));
    }
    
    output.push('COLLATE');
    
    if (node.collname) {
      const collname = ListUtils.unwrapList(node.collname);
      output.push(QuoteUtils.quote(collname.map(n => this.visit(n, context))));
    }
    
    return output.join(' ');
  }

  BooleanTest(node: t.BooleanTest['BooleanTest'], context: DeparserContext): string {
    const output: string[] = [];
    const boolContext = { ...context, bool: true };
    
    output.push(this.visit(node.arg, boolContext));
    
    switch (node.booltesttype as string) {
      case 'IS_TRUE':
        output.push('IS TRUE');
        break;
      case 'IS_NOT_TRUE':
        output.push('IS NOT TRUE');
        break;
      case 'IS_FALSE':
        output.push('IS FALSE');
        break;
      case 'IS_NOT_FALSE':
        output.push('IS NOT FALSE');
        break;
      case 'IS_UNKNOWN':
        output.push('IS UNKNOWN');
        break;
      case 'IS_NOT_UNKNOWN':
        output.push('IS NOT UNKNOWN');
        break;
    }
    
    return output.join(' ');
  }

  NullTest(node: t.NullTest['NullTest'], context: DeparserContext): string {
    const output: string[] = [];
    
    output.push(this.visit(node.arg, context));
    
    switch (node.nulltesttype as string) {
      case 'IS_NULL':
        output.push('IS NULL');
        break;
      case 'IS_NOT_NULL':
        output.push('IS NOT NULL');
        break;
    }
    
    return output.join(' ');
  }

  String(node: t.String['String'], context: DeparserContext): string {
    return node.sval ?? (node as any).str ?? '';
  }
  
  Integer(node: t.Integer['Integer'], context: DeparserContext): string { 
    return node.ival?.toString() || '0'; 
  }
  
  Float(node: t.Float['Float'], context: DeparserContext): string { 
    return node.fval || '0.0'; 
  }
  
  Boolean(node: t.Boolean['Boolean'], context: DeparserContext): string { 
    return node.boolval ? 'true' : 'false'; 
  }
  
  BitString(node: t.BitString['BitString'], context: DeparserContext): string { 
    return `B'${node.bsval}'`; 
  }
  
  Null(node: t.Node, context: DeparserContext): string { 
    return 'NULL'; 
  }

  CreateStmt(node: t.CreateStmt['CreateStmt'], context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    const relpersistence = (node.relation as any)?.relpersistence;
    if (relpersistence === 't') {
      output.push('TEMPORARY');
    } else if (relpersistence === 'u') {
      output.push('UNLOGGED');
    }

    output.push('TABLE');

    if (node.if_not_exists) {
      output.push('IF NOT EXISTS');
    }

    output.push(this.visit(node.relation, context));

    if (node.tableElts) {
      const elements = ListUtils.unwrapList(node.tableElts);
      const elementStrs = elements.map(el => {
        return this.deparse(el, context);
      });
      output.push(this.formatter.parens(elementStrs.join(', ')));
    }

    if (node.inhRelations) {
      output.push('INHERITS');
      const inherits = ListUtils.unwrapList(node.inhRelations);
      const inheritStrs = inherits.map(rel => this.visit(rel, context));
      output.push(this.formatter.parens(inheritStrs.join(', ')));
    }

    return output.join(' ');
  }

  ColumnDef(node: t.ColumnDef['ColumnDef'], context: DeparserContext): string {
    const output: string[] = [];

    if (node.colname) {
      output.push(QuoteUtils.quote(node.colname));
    }

    if (node.typeName) {
      // typeName is not wrapped in a node container
      output.push(this.TypeName(node.typeName as t.TypeName, context));
    }

    if (node.constraints) {
      const constraints = ListUtils.unwrapList(node.constraints);
      const constraintStrs = constraints.map(constraint => {
        return this.visit(constraint, context);
      });
      output.push(...constraintStrs);
    }

    if (node.raw_default) {
      output.push('DEFAULT');
      output.push(this.visit(node.raw_default, context));
    }

    if (node.is_not_null) {
      output.push('NOT NULL');
    }

    return output.join(' ');
  }

  Constraint(node: t.Constraint['Constraint'], context: DeparserContext): string {
    const output: string[] = [];

    switch (node.contype) {
      case 'CONSTR_NULL':
        output.push('NULL');
        break;
      case 'CONSTR_NOTNULL':
        output.push('NOT NULL');
        break;
      case 'CONSTR_DEFAULT':
        output.push('DEFAULT');
        if (node.raw_expr) {
          output.push(this.visit(node.raw_expr, context));
        }
        break;
      case 'CONSTR_CHECK':
        output.push('CHECK');
        if (node.raw_expr) {
          output.push(this.formatter.parens(this.visit(node.raw_expr, context)));
        }
        break;
      case 'CONSTR_PRIMARY':
        output.push('PRIMARY KEY');
        if (node.keys) {
          const keys = ListUtils.unwrapList(node.keys).map(k => this.visit(k, context));
          if (keys.length) {
            output.push(this.formatter.parens(keys.join(', ')));
          }
        }
        break;
      case 'CONSTR_UNIQUE':
        output.push('UNIQUE');
        if (node.keys) {
          const keys = ListUtils.unwrapList(node.keys).map(k => this.visit(k, context));
          if (keys.length) {
            output.push(this.formatter.parens(keys.join(', ')));
          }
        }
        break;
      case 'CONSTR_FOREIGN':
        output.push('REFERENCES');
        if (node.pktable) {
          output.push(this.visit(node.pktable, context));
        }
        if (node.fk_attrs) {
          const attrs = ListUtils.unwrapList(node.fk_attrs);
          const attrStrs = attrs.map(attr => this.visit(attr, context));
          output.push(this.formatter.parens(attrStrs.join(', ')));
        }
        break;
    }

    return output.join(' ');
  }

  SubLink(node: t.SubLink['SubLink'], context: DeparserContext): string {
    return this.formatter.parens(this.visit(node.subselect, context));
  }

  CaseWhen(node: t.CaseWhen['CaseWhen'], context: DeparserContext): string {
    const output: string[] = ['WHEN'];
    
    if (node.expr) {
      output.push(this.visit(node.expr, context));
    }
    
    output.push('THEN');
    
    if (node.result) {
      output.push(this.visit(node.result, context));
    }
    
    return output.join(' ');
  }

  WindowDef(node: t.WindowDef['WindowDef'], context: DeparserContext): string {
    const output: string[] = [];
    
    if (node.name) {
      output.push(node.name);
    }
    
    const windowParts: string[] = [];
    
    if (node.partitionClause) {
      const partitions = ListUtils.unwrapList(node.partitionClause);
      const partitionStrs = partitions.map(p => this.visit(p, context));
      windowParts.push(`PARTITION BY ${partitionStrs.join(', ')}`);
    }
    
    if (node.orderClause) {
      const orders = ListUtils.unwrapList(node.orderClause);
      const orderStrs = orders.map(o => this.visit(o, context));
      windowParts.push(`ORDER BY ${orderStrs.join(', ')}`);
    }
    
    if (windowParts.length > 0) {
      output.push(this.formatter.parens(windowParts.join(' ')));
    }
    
    return output.join(' ');
  }

  SortBy(node: t.SortBy['SortBy'], context: DeparserContext): string {
    const output: string[] = [];
    
    if (node.node) {
      output.push(this.visit(node.node, context));
    }
    
    if (node.sortby_dir === 'SORTBY_USING' && node.useOp) {
      output.push('USING');
      const useOp = ListUtils.unwrapList(node.useOp);
      output.push(useOp.map(op => this.visit(op, context)).join('.'));
    } else if (node.sortby_dir === 'SORTBY_ASC') {
      output.push('ASC');
    } else if (node.sortby_dir === 'SORTBY_DESC') {
      output.push('DESC');
    }
    
    if (node.sortby_nulls === 'SORTBY_NULLS_FIRST') {
      output.push('NULLS FIRST');
    } else if (node.sortby_nulls === 'SORTBY_NULLS_LAST') {
      output.push('NULLS LAST');
    }
    
    return output.join(' ');
  }

  GroupingSet(node: t.GroupingSet['GroupingSet'], context: DeparserContext): string {
    switch (node.kind) {
      case 'GROUPING_SET_EMPTY':
        return '()';
      case 'GROUPING_SET_SIMPLE':
        // Not present in raw parse trees
        return '';
      case 'GROUPING_SET_ROLLUP':
        const rollupContent = ListUtils.unwrapList(node.content);
        const rollupStrs = rollupContent.map(c => this.visit(c, context));
        return `ROLLUP (${rollupStrs.join(', ')})`;
      case 'GROUPING_SET_CUBE':
        const cubeContent = ListUtils.unwrapList(node.content);
        const cubeStrs = cubeContent.map(c => this.visit(c, context));
        return `CUBE (${cubeStrs.join(', ')})`;
      case 'GROUPING_SET_SETS':
        const setsContent = ListUtils.unwrapList(node.content);
        const setsStrs = setsContent.map(c => this.visit(c, context));
        return `GROUPING SETS (${setsStrs.join(', ')})`;
      default:
        return '';
    }
  }

  CommonTableExpr(node: t.CommonTableExpr['CommonTableExpr'], context: DeparserContext): string {
    const output: string[] = [];
    
    if (node.ctename) {
      output.push(node.ctename);
    }
    
    if (node.aliascolnames) {
      const colnames = ListUtils.unwrapList(node.aliascolnames);
      const colnameStrs = colnames.map(col => this.visit(col, context));
      output.push(this.formatter.parens(colnameStrs.join(', ')));
    }
    
    output.push('AS');
    
    if (node.ctequery) {
      output.push(this.formatter.parens(this.visit(node.ctequery, context)));
    }
    
    return output.join(' ');
  }

  ParamRef(node: t.ParamRef['ParamRef'], context: DeparserContext): string {
    return `$${node.number}`;
  }

  MinMaxExpr(node: t.MinMaxExpr['MinMaxExpr'], context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    const argStrs = args.map(arg => this.visit(arg, context));
    
    if (node.op === 'IS_GREATEST') {
      return `GREATEST(${argStrs.join(', ')})`;
    } else {
      return `LEAST(${argStrs.join(', ')})`;
    }
  }

  RowExpr(node: t.RowExpr['RowExpr'], context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    const argStrs = args.map(arg => this.visit(arg, context));
    return `ROW(${argStrs.join(', ')})`;
  }

  JoinExpr(node: t.JoinExpr['JoinExpr'], context: DeparserContext): string {
    const output: string[] = [];
    
    if (node.larg) {
      output.push(this.visit(node.larg, context));
    }
    
    switch (node.jointype) {
      case 'JOIN_INNER':
        output.push('INNER JOIN');
        break;
      case 'JOIN_LEFT':
        output.push('LEFT JOIN');
        break;
      case 'JOIN_FULL':
        output.push('FULL JOIN');
        break;
      case 'JOIN_RIGHT':
        output.push('RIGHT JOIN');
        break;
      default:
        output.push('JOIN');
    }
    
    if (node.rarg) {
      output.push(this.visit(node.rarg, context));
    }
    
    if (node.quals) {
      output.push('ON');
      output.push(this.visit(node.quals, context));
    }
    
    return output.join(' ');
  }

  FromExpr(node: t.FromExpr['FromExpr'], context: DeparserContext): string {
    const fromlist = ListUtils.unwrapList(node.fromlist);
    const fromStrs = fromlist.map(item => this.visit(item, context));

    let result = fromStrs.join(', ');

    if (node.quals) {
      result += ` WHERE ${this.visit(node.quals, context)}`;
    }

    return result;
  }

  TransactionStmt(node: t.TransactionStmt['TransactionStmt'], context: DeparserContext): string {
    switch (node.kind) {
      case 'TRANS_STMT_BEGIN':
        return 'BEGIN';
      case 'TRANS_STMT_START':
        return 'START TRANSACTION';
      case 'TRANS_STMT_COMMIT':
        return node.chain ? 'COMMIT AND CHAIN' : 'COMMIT';
      case 'TRANS_STMT_ROLLBACK':
        return node.chain ? 'ROLLBACK AND CHAIN' : 'ROLLBACK';
      case 'TRANS_STMT_SAVEPOINT':
        return `SAVEPOINT ${QuoteUtils.quote(node.savepoint_name!)}`;
      case 'TRANS_STMT_RELEASE':
        return `RELEASE ${QuoteUtils.quote(node.savepoint_name!)}`;
      case 'TRANS_STMT_ROLLBACK_TO':
        return `ROLLBACK TO SAVEPOINT ${QuoteUtils.quote(node.savepoint_name!)}`;
      case 'TRANS_STMT_PREPARE':
        return `PREPARE TRANSACTION '${node.gid}'`;
      case 'TRANS_STMT_COMMIT_PREPARED':
        return `COMMIT PREPARED '${node.gid}'`;
      case 'TRANS_STMT_ROLLBACK_PREPARED':
        return `ROLLBACK PREPARED '${node.gid}'`;
      default:
        return '';
    }
  }

  DropStmt(node: t.DropStmt['DropStmt'], context: DeparserContext): string {
    const typeMap: Record<string, string> = {
      OBJECT_TABLE: 'TABLE',
      OBJECT_INDEX: 'INDEX',
      OBJECT_SCHEMA: 'SCHEMA',
      OBJECT_VIEW: 'VIEW',
      OBJECT_MATVIEW: 'MATERIALIZED VIEW',
      OBJECT_SEQUENCE: 'SEQUENCE'
    };

    const objects = ListUtils.unwrapList(node.objects).map(list => {
      const names = ListUtils.unwrapList(list).map(n => this.visit(n, context));
      return names.join('.');
    });

    const parts: string[] = ['DROP'];
    parts.push(typeMap[node.removeType as string] || node.removeType!);

    if (node.concurrent) {
      parts.push('CONCURRENTLY');
    }

    if (node.missing_ok) {
      parts.push('IF EXISTS');
    }

    parts.push(objects.join(', '));

    if (node.behavior === 'DROP_CASCADE') {
      parts.push('CASCADE');
    }

    return parts.join(' ');
  }

  TruncateStmt(node: t.TruncateStmt['TruncateStmt'], context: DeparserContext): string {
    const rels = ListUtils.unwrapList(node.relations).map(r => this.visit(r, context)).join(', ');
    const parts: string[] = ['TRUNCATE', rels];

    if (node.restart_seqs) {
      parts.push('RESTART IDENTITY');
    }

    if (node.behavior === 'DROP_CASCADE') {
      parts.push('CASCADE');
    }

    return parts.join(' ');
  }

  IndexElem(node: t.IndexElem['IndexElem'], context: DeparserContext): string {
    const parts: string[] = [];

    if (node.name) {
      parts.push(QuoteUtils.quote(node.name));
    } else if (node.expr) {
      parts.push(this.visit(node.expr, context));
    }

    if (node.collation) {
      const coll = ListUtils.unwrapList(node.collation)
        .map(c => this.visit(c, context))
        .join('.');
      if (coll) {
        parts.push(`COLLATE ${coll}`);
      }
    }

    if (node.opclass) {
      const opclass = ListUtils.unwrapList(node.opclass)
        .map(o => this.visit(o, context))
        .join('.');
      if (opclass) {
        parts.push(opclass);
      }
    }

    switch (node.ordering) {
      case 'SORTBY_ASC':
        parts.push('ASC');
        break;
      case 'SORTBY_DESC':
        parts.push('DESC');
        break;
    }

    switch (node.nulls_ordering) {
      case 'SORTBY_NULLS_FIRST':
        parts.push('NULLS FIRST');
        break;
      case 'SORTBY_NULLS_LAST':
        parts.push('NULLS LAST');
        break;
    }

    return parts.join(' ');
  }

  IndexStmt(node: t.IndexStmt['IndexStmt'], context: DeparserContext): string {
    const parts: string[] = ['CREATE'];

    if (node.unique) {
      parts.push('UNIQUE');
    }

    parts.push('INDEX');

    if (node.concurrent) {
      parts.push('CONCURRENTLY');
    }

    if (node.if_not_exists) {
      parts.push('IF NOT EXISTS');
    }

    if (node.idxname) {
      parts.push(QuoteUtils.quote(node.idxname));
    }

    parts.push('ON');
    parts.push(this.visit(node.relation, context));

    if (node.accessMethod) {
      parts.push('USING');
      parts.push(node.accessMethod.toUpperCase());
    }

    const params = ListUtils.unwrapList(node.indexParams);
    if (params.length) {
      const elems = params.map(p => this.visit(p, context));
      parts.push(this.formatter.parens(elems.join(', ')));
    }

    const include = ListUtils.unwrapList(node.indexIncludingParams);
    if (include.length) {
      const elems = include.map(p => this.visit(p, context));
      parts.push(`INCLUDE ${this.formatter.parens(elems.join(', '))}`);
    }

    if (node.nulls_not_distinct) {
      parts.push('NULLS NOT DISTINCT');
    }

    if (node.options) {
      const opts = ListUtils.unwrapList(node.options).map(o => this.visit(o, context));
      if (opts.length) {
        parts.push(`WITH (${opts.join(', ')})`);
      }
    }

    if (node.tableSpace) {
      parts.push('TABLESPACE');
      parts.push(QuoteUtils.quote(node.tableSpace));
    }

    if (node.whereClause) {
      parts.push('WHERE');
      parts.push(this.visit(node.whereClause, context));
    }

    return parts.join(' ');
  }

  CreateSchemaStmt(node: t.CreateSchemaStmt['CreateSchemaStmt'], context: DeparserContext): string {
    const parts: string[] = ['CREATE SCHEMA'];

    if (node.if_not_exists) {
      parts.push('IF NOT EXISTS');
    }

    if (node.schemaname) {
      parts.push(QuoteUtils.quote(node.schemaname));
    }

    if (node.authrole) {
      parts.push('AUTHORIZATION');
      parts.push(this.visit(node.authrole, context));
    }

    return parts.join(' ');
  }

  RoleSpec(node: t.RoleSpec['RoleSpec'], context: DeparserContext): string {
    switch (node.roletype) {
      case 'ROLESPEC_CSTRING':
        return QuoteUtils.quote(node.rolename!);
      case 'ROLESPEC_CURRENT_USER':
        return 'CURRENT_USER';
      case 'ROLESPEC_CURRENT_ROLE':
        return 'CURRENT_ROLE';
      case 'ROLESPEC_SESSION_USER':
        return 'SESSION_USER';
      case 'ROLESPEC_PUBLIC':
        return 'PUBLIC';
      default:
        return QuoteUtils.quote(node.rolename!);
    }
  }

  AccessPriv(node: t.AccessPriv['AccessPriv'], context: DeparserContext): string {
    const name = node.priv_name ? node.priv_name.toUpperCase() : '';
    const cols = ListUtils.unwrapList(node.cols).map(c => this.visit(c, context));
    if (cols.length) {
      return `${name}${this.formatter.parens(cols.join(', '))}`.trim();
    }
    return name;
  }

  GrantStmt(node: t.GrantStmt['GrantStmt'], context: DeparserContext): string {
    const parts: string[] = [];

    if (node.is_grant) {
      parts.push('GRANT');
    } else {
      parts.push('REVOKE');
      if (node.grant_option) {
        parts.push('GRANT OPTION FOR');
      }
    }

    const privs = ListUtils.unwrapList(node.privileges).map(p => this.visit(p, context));
    if (privs.length) {
      parts.push(privs.join(', '));
    } else {
      parts.push('ALL');
    }

    parts.push('ON');

    const typeMap: Record<string, string> = {
      OBJECT_TABLE: 'TABLE',
      OBJECT_SEQUENCE: 'SEQUENCE',
      OBJECT_DATABASE: 'DATABASE',
      OBJECT_SCHEMA: 'SCHEMA',
      OBJECT_FUNCTION: 'FUNCTION',
      OBJECT_LANGUAGE: 'LANGUAGE',
      OBJECT_LARGEOBJECT: 'LARGE OBJECT',
      OBJECT_VIEW: 'VIEW',
      OBJECT_MATVIEW: 'MATERIALIZED VIEW',
      OBJECT_TYPE: 'TYPE',
      OBJECT_TABLESPACE: 'TABLESPACE'
    };

    let objType = typeMap[node.objtype as string];
    if (!objType) {
      objType = (node.objtype || '').replace('OBJECT_', '');
    }

    if (node.targtype === 'ACL_TARGET_ALL_IN_SCHEMA') {
      parts.push(`ALL ${objType}s IN SCHEMA`);
    } else if (node.targtype === 'ACL_TARGET_DEFAULTS') {
      parts.push(objType + 'S');
    } else {
      parts.push(objType);
    }

    const objs = ListUtils.unwrapList(node.objects).map(o => this.visit(o, context));
    if (objs.length) {
      parts.push(objs.join(', '));
    }

    if (node.is_grant) {
      parts.push('TO');
    } else {
      parts.push('FROM');
    }
    const grantees = ListUtils.unwrapList(node.grantees).map(g => this.visit(g, context));
    if (grantees.length) {
      parts.push(grantees.join(', '));
    }

    if (node.is_grant && node.grant_option) {
      parts.push('WITH GRANT OPTION');
    }

    if (node.grantor) {
      parts.push('GRANTED BY');
      parts.push(this.visit(node.grantor, context));
    }

    if (node.behavior === 'DROP_CASCADE') {
      parts.push('CASCADE');
    }

    return parts.join(' ');
  }

  GrantRoleStmt(node: t.GrantRoleStmt['GrantRoleStmt'], context: DeparserContext): string {
    const parts: string[] = [];

    const optAdmin = ListUtils.unwrapList(node.opt).some(opt => {
      if (this.getNodeType(opt) === 'DefElem') {
        const d = this.getNodeData(opt);
        return d.defname === 'admin' && d.arg?.Boolean?.boolval;
      }
      return false;
    });

    if (node.is_grant) {
      parts.push('GRANT');
    } else {
      parts.push('REVOKE');
      if (optAdmin) {
        parts.push('ADMIN OPTION FOR');
      }
    }

    const granted = ListUtils.unwrapList(node.granted_roles).map(r => this.visit(r, context));
    if (granted.length) {
      parts.push(granted.join(', '));
    }

    if (node.is_grant) {
      parts.push('TO');
    } else {
      parts.push('FROM');
    }

    const grantees = ListUtils.unwrapList(node.grantee_roles).map(r => this.visit(r, context));
    if (grantees.length) {
      parts.push(grantees.join(', '));
    }

    if (node.is_grant && optAdmin) {
      parts.push('WITH ADMIN OPTION');
    }

    if (node.grantor) {
      parts.push('GRANTED BY');
      parts.push(this.visit(node.grantor, context));
    }

    if (node.behavior === 'DROP_CASCADE') {
      parts.push('CASCADE');
    }

    return parts.join(' ');
  }

  AlterDefaultPrivilegesStmt(node: t.AlterDefaultPrivilegesStmt['AlterDefaultPrivilegesStmt'], context: DeparserContext): string {
    const parts: string[] = ['ALTER DEFAULT PRIVILEGES'];

    const options = ListUtils.unwrapList(node.options);
    for (const opt of options) {
      if (this.getNodeType(opt) === 'DefElem') {
        const d = this.getNodeData(opt);
        const names = ListUtils.unwrapList(d.arg).map(a => this.visit(a, context)).join(', ');
        if (d.defname === 'schemas') {
          parts.push('IN SCHEMA');
          parts.push(names);
        } else if (d.defname === 'roles') {
          parts.push('FOR ROLE');
          parts.push(names);
        }
      }
    }

    if (node.action) {
      const type = this.getNodeType(node.action as any);
      const actionNode =
        type === 'GrantStmt'
          ? (node.action as any)
          : { GrantStmt: node.action as unknown as t.GrantStmt['GrantStmt'] };
      parts.push(this.visit(actionNode, context));
    }

    return parts.join(' ');
  }

  CreatePolicyStmt(node: t.CreatePolicyStmt['CreatePolicyStmt'], context: DeparserContext): string {
    const parts: string[] = ['CREATE POLICY'];

    if (node.policy_name) {
      parts.push(QuoteUtils.quote(node.policy_name));
    }

    if (node.table) {
      parts.push('ON');
      parts.push(this.visit(node.table, context));
    }

    if (node.permissive === false) {
      parts.push('AS RESTRICTIVE');
    }

    if (node.cmd_name && node.cmd_name !== 'all') {
      parts.push('FOR');
      parts.push(node.cmd_name.toUpperCase());
    }

    parts.push('TO');
    const roles = ListUtils.unwrapList(node.roles).map(r => this.visit(r, context));
    if (roles.length) {
      parts.push(roles.join(', '));
    } else {
      parts.push('PUBLIC');
    }

    if (node.qual) {
      parts.push('USING');
      parts.push(this.formatter.parens(this.visit(node.qual, context)));
    }

    if (node.with_check) {
      parts.push('WITH CHECK');
      parts.push(this.formatter.parens(this.visit(node.with_check, context)));
    }

    return parts.join(' ');
  }

  AlterPolicyStmt(node: t.AlterPolicyStmt['AlterPolicyStmt'], context: DeparserContext): string {
    const parts: string[] = ['ALTER POLICY'];

    if (node.policy_name) {
      parts.push(QuoteUtils.quote(node.policy_name));
    }

    if (node.table) {
      parts.push('ON');
      parts.push(this.visit(node.table, context));
    }

    const roles = ListUtils.unwrapList(node.roles).map(r => this.visit(r, context));
    if (roles.length) {
      parts.push('TO');
      parts.push(roles.join(', '));
    }

    if (node.qual) {
      parts.push('USING');
      parts.push(this.formatter.parens(this.visit(node.qual, context)));
    }

    if (node.with_check) {
      parts.push('WITH CHECK');
      parts.push(this.formatter.parens(this.visit(node.with_check, context)));
    }

    return parts.join(' ');
  }

  DefElem(node: t.DefElem['DefElem'], context: DeparserContext): string {
    let name = node.defname?.toUpperCase() || '';
    if (node.defnamespace) {
      name = `${node.defnamespace.toUpperCase()}.${name}`;
    }

    if (node.arg) {
      const value = this.visit(node.arg, context);
      return `${name} ${value}`.trim();
    }

    return name;
  }

  VariableSetStmt(node: t.VariableSetStmt['VariableSetStmt'], context: DeparserContext): string {
    switch (node.kind) {
      case 'VAR_SET_VALUE':
        const vals = ListUtils.unwrapList(node.args).map(a => this.visit(a, context)).join(', ');
        return `SET ${node.is_local ? 'LOCAL ' : ''}${node.name} = ${vals}`;
      case 'VAR_SET_DEFAULT':
        return `SET ${node.name} TO DEFAULT`;
      case 'VAR_SET_CURRENT':
        return `SET ${node.name} FROM CURRENT`;
      case 'VAR_RESET':
        return `RESET ${node.name}`;
      case 'VAR_RESET_ALL':
        return 'RESET ALL';
      default:
        const args = ListUtils.unwrapList(node.args).map(a => this.visit(a, context)).join(', ');
        return `SET ${node.name} ${args}`.trim();
    }
  }

  VariableShowStmt(node: t.VariableShowStmt['VariableShowStmt'], context: DeparserContext): string {
    return `SHOW ${node.name}`;
  }

  CreateExtensionStmt(node: t.CreateExtensionStmt['CreateExtensionStmt'], context: DeparserContext): string {
    const parts: string[] = ['CREATE EXTENSION'];

    if (node.if_not_exists) {
      parts.push('IF NOT EXISTS');
    }

    if (node.extname) {
      parts.push(QuoteUtils.quote(node.extname));
    }

    if (node.options) {
      const opts = ListUtils.unwrapList(node.options).map(o => this.visit(o, context));
      if (opts.length) {
        parts.push('WITH');
        parts.push(opts.join(' '));
      }
    }

    return parts.join(' ');
  }

  ExplainStmt(node: t.ExplainStmt['ExplainStmt'], context: DeparserContext): string {
    const parts: string[] = ['EXPLAIN'];

    const opts = ListUtils.unwrapList(node.options).map(o => this.visit(o, context));
    if (opts.length) {
      parts.push(this.formatter.parens(opts.join(', ')));
    }

    if (node.query) {
      parts.push(this.visit(node.query, context));
    }

    return parts.join(' ');
  }

  VacuumStmt(node: t.VacuumStmt['VacuumStmt'], context: DeparserContext): string {
    const parts: string[] = [node.is_vacuumcmd ? 'VACUUM' : 'ANALYZE'];

    const opts = ListUtils.unwrapList(node.options).map(o => this.visit(o, context));
    if (opts.length) {
      parts.push(this.formatter.parens(opts.join(', ')));
    }

    const rels = ListUtils.unwrapList(node.rels).map(r => {
      const rel = this.getNodeData(r);
      let relStr = this.visit(rel.relation, context);
      const cols = ListUtils.unwrapList(rel.va_cols).map(c => this.visit(c, context));
      if (cols.length) {
        relStr += this.formatter.parens(cols.join(', '));
      }
      return relStr;
    });

    if (rels.length) {
      parts.push(rels.join(', '));
    }

    return parts.join(' ');
  }

  LockStmt(node: t.LockStmt['LockStmt'], context: DeparserContext): string {
    const rels = ListUtils.unwrapList(node.relations).map(r => this.visit(r, context)).join(', ');
    const parts: string[] = ['LOCK TABLE', rels];

    const modeMap: Record<number, string> = {
      1: 'ACCESS SHARE',
      2: 'ROW SHARE',
      3: 'ROW EXCLUSIVE',
      4: 'SHARE UPDATE EXCLUSIVE',
      5: 'SHARE',
      6: 'SHARE ROW EXCLUSIVE',
      7: 'EXCLUSIVE',
      8: 'ACCESS EXCLUSIVE'
    };

    if (node.mode && node.mode !== 8) {
      const m = modeMap[node.mode];
      if (m) {
        parts.push('IN', m, 'MODE');
      }
    }

    if (node.nowait) {
      parts.push('NOWAIT');
    }

    return parts.join(' ');
  }

  CopyStmt(node: t.CopyStmt['CopyStmt'], context: DeparserContext): string {
    const parts: string[] = ['COPY'];

    if (node.query) {
      parts.push(this.formatter.parens(this.visit(node.query, context)));
    } else if (node.relation) {
      parts.push(this.visit(node.relation, context));
    }

    parts.push(node.is_from ? 'FROM' : 'TO');

    if (node.filename) {
      parts.push(QuoteUtils.escape(node.filename));
    }

    const opts = ListUtils.unwrapList(node.options).map(o => this.visit(o, context));
    if (opts.length) {
      parts.push(this.formatter.parens(opts.join(', ')));
    }

    return parts.join(' ');
  }
}
