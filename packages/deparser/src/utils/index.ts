/* eslint-disable no-restricted-syntax */

export const cleanLines = (sql: string) => {
  return sql
    .split('\n')
    .map((l) => l.trim())
    .filter((a) => a)
    .join('\n');
};

export const transform = (obj: any, props: any): any => {
  let copy: any = null;
  // Handle the 3 simple types, and null or undefined
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (let i = 0, len = obj.length; i < len; i++) {
      copy[i] = transform(obj[i], props);
    }
    return copy;
  }

  // Handle Object
  if (obj instanceof Object || typeof obj === 'object') {
    copy = {};
    for (const attr in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, attr)) {
        if (Object.prototype.hasOwnProperty.call(props, attr)) {
          if (typeof props[attr] === 'function') {
            const val = props[attr](obj[attr]);
            if (val !== undefined) {
              copy[attr] = val;
            }
          } else if (Object.prototype.hasOwnProperty.call(props[attr], obj[attr])) {
            copy[attr] = props[attr][obj[attr]];
          } else {
            const val = transform(obj[attr], props);
            if (val !== undefined) {
              copy[attr] = val;
            }
          }
        } else {
          const val = transform(obj[attr], props);
          if (val !== undefined) {
            copy[attr] = val;
          }
        }
      }
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
};

const noop = (): undefined => undefined;

function stripRangeDefaults(node: any): any {
  if (Array.isArray(node)) {
    return node.map(stripRangeDefaults);
  }
  if (node && typeof node === 'object') {
    if ('relname' in node) {
      if (node.inh === true) delete node.inh;
      if (node.relpersistence === 'p') delete node.relpersistence;
    }
    for (const key of Object.keys(node)) {
      node[key] = stripRangeDefaults(node[key]);
    }
  }
  return node;
}

export const cleanTree = (tree: any) => {
  const cleaned = transform(tree, {
    stmt_len: noop,
    stmt_location: noop,
    location: noop,
    RangeVar: (obj: any) => {
      if (obj.inh === true) delete obj.inh;
      if (obj.relpersistence === 'p') delete obj.relpersistence;
      return cleanTree(obj);
    },
    IndexElem: (obj: any) => {
      if (obj.ordering === 'SORTBY_DEFAULT') delete obj.ordering;
      if (obj.nulls_ordering === 'SORTBY_NULLS_DEFAULT') delete obj.nulls_ordering;
      return cleanTree(obj);
    },
    DefElem: (obj: any) => {
      if (obj.defname === 'as') {
        if (Array.isArray(obj.arg) && obj.arg.length) {
          // function
          obj.arg[0].String.str = obj.arg[0].String.str.trim();
        } else if (obj.arg.List && obj.arg.List.items) {
          // function
          obj.arg.List.items[0].String.str = obj.arg.List.items[0].String.str.trim();
        } else {
          // do stmt
          obj.arg.String.str = obj.arg.String.str.trim();
        }
      }
      if (obj.defaction === 'DEFELEM_UNSPEC') delete obj.defaction;
      return cleanTree(obj);
    },
    ColumnDef: (obj: any) => {
      if (obj.is_local === true) delete obj.is_local;
      return cleanTree(obj);
    },
    InsertStmt: (obj: any) => {
      if (obj.override === 'OVERRIDING_NOT_SET') delete obj.override;
      return cleanTree(obj);
    },
    SelectStmt: (obj: any) => {
      if (obj.limitOption === 'LIMIT_OPTION_DEFAULT') delete obj.limitOption;
      if (obj.op === 'SETOP_NONE') delete obj.op;
      return cleanTree(obj);
    },
    String: (obj: any) => {
      if (obj.str !== undefined && obj.sval === undefined) {
        obj.sval = obj.str;
        delete obj.str;
      }
      return obj;
    }
  });
  return stripRangeDefaults(cleaned);
};

export const cleanTreeWithStmt = (tree: any) => {
  const cleaned = transform(tree, {
    stmt_location: noop,
    location: noop
  });
  return stripRangeDefaults(cleaned);
};
