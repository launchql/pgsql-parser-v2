import { deparse } from "../src";
import {
  Node,
  RawStmt,
  SelectStmt,
  ResTarget,
  A_Const,
  ColumnRef,
  RangeVar,
  A_Expr,
  InsertStmt,
  UpdateStmt,
  DeleteStmt,
  BoolExpr,
} from "../../types/src/types";
import {
  A_Expr_Kind,
  BoolExprType,
  SetOperation,
  LimitOption,
} from "../../enums/src/enums";

type N = Node;

const integer = (n: number): N => ({ Integer: { ival: n } });
const string = (s: string): N => ({ String: { str: s } });
const boolean = (b: boolean): N => ({ Boolean: { boolval: b } });

const aConstInt = (n: number): N => ({ A_Const: { ival: integer(n) } });
const aConstStr = (s: string): N => ({ A_Const: { sval: string(s) } });
const aConstBool = (b: boolean): N => ({ A_Const: { boolval: boolean(b) } });

const column = (name: string): N => ({ ColumnRef: { fields: [string(name)] } });
const star = (): N => ({ ColumnRef: { fields: [{ A_Star: {} }] } });
const rangeVar = (name: string): N => ({
  RangeVar: { relname: name, inh: true, relpersistence: "p" },
});

const resTarget = (val: N | null, name?: string): N => ({
  ResTarget: { val: val || undefined, name },
});

const aExpr = (op: string, left: N, right: N): N => ({
  A_Expr: {
    kind: A_Expr_Kind.AEXPR_OP,
    name: [string(op)],
    lexpr: left,
    rexpr: right,
  },
});

const boolAnd = (...args: N[]): N => ({
  BoolExpr: { boolop: BoolExprType.AND_EXPR, args },
});

const raw = (stmt: N): N => ({ RawStmt: { stmt } });

describe("basic deparser", () => {
  test("SELECT 1", () => {
    const ast = raw({
      SelectStmt: {
        targetList: [resTarget(aConstInt(1))],
        op: SetOperation.SETOP_NONE,
        limitOption: LimitOption.LIMIT_OPTION_DEFAULT,
      },
    });
    expect(deparse(ast)).toBe("SELECT 1");
  });

  test("SELECT * FROM users WHERE name = 'Alice'", () => {
    const ast = raw({
      SelectStmt: {
        targetList: [resTarget(star())],
        fromClause: [rangeVar("users")],
        whereClause: aExpr("=", column("name"), aConstStr("Alice")),
        op: SetOperation.SETOP_NONE,
        limitOption: LimitOption.LIMIT_OPTION_DEFAULT,
      },
    });
    expect(deparse(ast)).toBe("SELECT * FROM users WHERE name = 'Alice'");
  });

  test("INSERT INTO items (id, label) VALUES (1, 'thing')", () => {
    const ast = raw({
      InsertStmt: {
        relation: rangeVar("items"),
        cols: [resTarget(null, "id"), resTarget(null, "label")],
        selectStmt: {
          SelectStmt: {
            valuesLists: [
              { List: { items: [aConstInt(1), aConstStr("thing")] } },
            ],
            op: SetOperation.SETOP_NONE,
            limitOption: LimitOption.LIMIT_OPTION_DEFAULT,
          },
        },
      },
    });
    expect(deparse(ast)).toBe(
      "INSERT INTO items (id, label) VALUES (1, 'thing')"
    );
  });

  test("UPDATE orders SET status = 'shipped' WHERE id = 5", () => {
    const ast = raw({
      UpdateStmt: {
        relation: rangeVar("orders"),
        targetList: [
          resTarget(
            aExpr("=", column("status"), aConstStr("shipped")),
            undefined
          ),
        ],
        whereClause: aExpr("=", column("id"), aConstInt(5)),
      },
    });
    expect(deparse(ast)).toBe(
      "UPDATE orders SET status = 'shipped' WHERE id = 5"
    );
  });

  test("DELETE FROM sessions WHERE expired = true", () => {
    const ast = raw({
      DeleteStmt: {
        relation: rangeVar("sessions"),
        whereClause: aExpr("=", column("expired"), aConstBool(true)),
      },
    });
    expect(deparse(ast)).toBe("DELETE FROM sessions WHERE expired = TRUE");
  });
});
