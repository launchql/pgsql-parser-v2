import {
  A_Const,
  A_Expr,
  A_Star,
  ColumnRef,
  DeleteStmt,
  InsertStmt,
  Node,
  RawStmt,
  RangeVar,
  ResTarget,
  SelectStmt,
  UpdateStmt,
  BoolExpr,
} from "@pgsql/types";
import { A_Expr_Kind, BoolExprType } from "@pgsql/enums";

/** Simple SQL deparser focused on basic DML statements. */
export class Deparser {
  static deparse(node: Node | Node[]): string {
    const d = new Deparser();
    if (Array.isArray(node)) {
      return node.map((n) => d.dispatch(n)).join("\n");
    }
    return d.dispatch(node);
  }

  private dispatch(node: Node): string {
    if ((node as RawStmt).RawStmt)
      return this.rawStmt((node as RawStmt).RawStmt);
    if ((node as SelectStmt).SelectStmt)
      return this.selectStmt((node as any).SelectStmt);
    if ((node as InsertStmt).InsertStmt)
      return this.insertStmt((node as any).InsertStmt);
    if ((node as UpdateStmt).UpdateStmt)
      return this.updateStmt((node as any).UpdateStmt);
    if ((node as DeleteStmt).DeleteStmt)
      return this.deleteStmt((node as any).DeleteStmt);
    if ((node as ResTarget).ResTarget)
      return this.resTarget((node as any).ResTarget);
    if ((node as ColumnRef).ColumnRef)
      return this.columnRef((node as any).ColumnRef);
    if ((node as A_Const).A_Const) return this.aConst((node as any).A_Const);
    if ((node as A_Expr).A_Expr) return this.aExpr((node as any).A_Expr);
    if ((node as BoolExpr).BoolExpr)
      return this.boolExpr((node as any).BoolExpr);
    if ((node as A_Star).A_Star !== undefined) return "*";
    throw new Error("Unhandled node: " + JSON.stringify(node));
  }

  private rawStmt(stmt: RawStmt["RawStmt"]): string {
    return this.dispatch(stmt.stmt!);
  }

  private selectStmt(stmt: SelectStmt["SelectStmt"]): string {
    const targets = (stmt.targetList || []).map((t) => this.dispatch(t));
    const select = "SELECT " + (targets.length ? targets.join(", ") : "*");
    const froms = stmt.fromClause
      ? (stmt.fromClause as Node[]).map((f) => this.dispatch(f)).join(", ")
      : "";
    const from = froms ? " FROM " + froms : "";
    const where = stmt.whereClause
      ? " WHERE " + this.dispatch(stmt.whereClause)
      : "";
    return select + from + where;
  }

  private insertStmt(stmt: InsertStmt["InsertStmt"]): string {
    const table = this.dispatch(stmt.relation!);
    const cols = stmt.cols
      ? " (" +
        (stmt.cols as Node[]).map((c) => this.dispatch(c)).join(", ") +
        ")"
      : "";
    const valuesList =
      stmt.selectStmt && (stmt.selectStmt as any).SelectStmt?.valuesLists;
    let values = "";
    if (valuesList && Array.isArray(valuesList[0])) {
      const row = (valuesList[0] as Node[]).map((v) => this.dispatch(v));
      values = " VALUES (" + row.join(", ") + ")";
    }
    return "INSERT INTO " + table + cols + values;
  }

  private updateStmt(stmt: UpdateStmt["UpdateStmt"]): string {
    const table = this.dispatch(stmt.relation!);
    const sets = (stmt.targetList || [])
      .map((t) => this.dispatch(t))
      .join(", ");
    const where = stmt.whereClause
      ? " WHERE " + this.dispatch(stmt.whereClause)
      : "";
    return "UPDATE " + table + " SET " + sets + where;
  }

  private deleteStmt(stmt: DeleteStmt["DeleteStmt"]): string {
    const table = this.dispatch(stmt.relation!);
    const where = stmt.whereClause
      ? " WHERE " + this.dispatch(stmt.whereClause)
      : "";
    return "DELETE FROM " + table + where;
  }

  private resTarget(target: ResTarget["ResTarget"]): string {
    const val = this.dispatch(target.val!);
    return target.name ? `${val} AS ${this.quoteIdent(target.name)}` : val;
  }

  private columnRef(ref: ColumnRef["ColumnRef"]): string {
    const fields = (ref.fields || []).map((f) => this.dispatch(f));
    return fields.map((f) => (f === "*" ? "*" : this.quoteIdent(f))).join(".");
  }

  private aConst(c: A_Const["A_Const"]): string {
    if (c.val?.Integer) return String(c.val.Integer.ival);
    if (c.val?.Float) return c.val.Float.str;
    if (c.val?.String) return this.quoteLiteral(c.val.String.str);
    if (c.val?.Boolean !== undefined) return c.val.Boolean ? "TRUE" : "FALSE";
    throw new Error("Unsupported A_Const");
  }

  private aExpr(expr: A_Expr["A_Expr"]): string {
    const op = (expr.name?.[0] as any)?.String?.str || "";
    const left = expr.lexpr ? this.dispatch(expr.lexpr) : "";
    const right = expr.rexpr ? this.dispatch(expr.rexpr) : "";
    switch (expr.kind) {
      case A_Expr_Kind.AEXPR_OP:
        return `${left} ${op} ${right}`.trim();
      default:
        throw new Error("Unsupported A_Expr kind");
    }
  }

  private boolExpr(expr: BoolExpr["BoolExpr"]): string {
    const args = (expr.args || []) as Node[];
    const parts = args.map((a) => this.dispatch(a));
    switch (expr.boolop) {
      case BoolExprType.AND_EXPR:
        return parts.join(" AND ");
      case BoolExprType.OR_EXPR:
        return parts.join(" OR ");
      default:
        throw new Error("Unsupported BoolExpr");
    }
  }

  private quoteIdent(id: string): string {
    return /[^a-z0-9_]/i.test(id) ? `"${id}"` : id;
  }

  private quoteLiteral(val: string): string {
    return `'${val.replace(/'/g, "''")}'`;
  }
}

export const deparse = Deparser.deparse;
