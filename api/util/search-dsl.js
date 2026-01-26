// search-dsl.js
import { z } from "zod";

/**
 * @typedef {"string"|"number"|"date"|"boolean"} FieldType
 *
 * @typedef {Object} FieldDef
 * @property {FieldType} type
 * @property {string[]=} operators Optional override of allowed operators for this field
 *
 * @typedef {Record<string, FieldDef>} FieldDefs
 */

/* ---------------------------- operator allowlists ---------------------------- */

const OPERATORS_BY_TYPE = /** @type {const} */ ({
  string: ["EQ", "NEQ", "IN", "NIN", "LIKE", "NLIKE"],
  number: ["EQ", "NEQ", "LT", "LTE", "GT", "GTE", "IN", "NIN"],
  date: ["EQ", "NEQ", "BEFORE", "AFTER", "LT", "LTE", "GT", "GTE"],
  boolean: ["EQ", "NEQ"],
});

const LOGICAL_KEYS = /** @type {const} */ (["AND", "OR", "NOT"]);
const CONTROL_KEYS = /** @type {const} */ (["ORDER", "LIMIT", "OFFSET"]);
const ORDER_DIRECTIONS = /** @type {const} */ (["ASC", "DESC"]);

/* ---------------------------------- errors ---------------------------------- */

export class SearchDslError extends Error {
  /**
   * @param {string} message Human-readable message
   * @param {object} details Machine-readable payload
   */
  constructor(message, details) {
    super(message);
    this.name = "SearchDslError";
    this.details = details;
  }
}

/* --------------------------------- utilities -------------------------------- */

const isPlainObject = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const pathToString = (path) =>
  path.length === 0 ? "$" : `$.${path.map(String).join(".")}`;

/**
 * @param {unknown} v
 * @returns {"string"|"number"|"boolean"|"object"|"array"|"null"|"unknown"}
 */
const valueKind = (v) => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean" || t === "object")
    return /** @type {any} */ (t);
  return "unknown";
};

/**
 * Coerce/validate date input accepted by the DSL.
 * - Accepts ISO date strings or Date objects.
 * - Returns an ISO string (to make downstream compilers easier).
 * @param {unknown} v
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 */
const coerceDateToIso = (v) => {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { ok: false, reason: "Invalid Date" };
    return { ok: true, value: v.toISOString() };
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime()))
      return { ok: false, reason: "Invalid date string" };
    return { ok: true, value: d.toISOString() };
  }
  return { ok: false, reason: "Expected date string or Date" };
};

/* ------------------------------ value validators ----------------------------- */

/**
 * Validate operator value by field type + operator.
 * Returns normalized value (e.g., dates -> ISO string).
 *
 * @param {FieldType} fieldType
 * @param {string} op
 * @param {unknown} opVal
 * @returns {{ ok: true, value: any } | { ok: false, reason: string }}
 */
const validateOperatorValue = (fieldType, op, opVal) => {
  // IN / NIN must be arrays
  if (op === "IN" || op === "NIN") {
    if (!Array.isArray(opVal))
      return { ok: false, reason: "Expected an array" };
    if (opVal.length === 0)
      return { ok: false, reason: "Array must be non-empty" };

    // validate each element type
    const normalized = [];
    for (let i = 0; i < opVal.length; i += 1) {
      const item = opVal[i];
      const single = validateOperatorValue(fieldType, "EQ", item);
      if (!single.ok)
        return {
          ok: false,
          reason: `Bad element at index ${i}: ${single.reason}`,
        };
      normalized.push(single.value);
    }
    return { ok: true, value: normalized };
  }

  // LIKE / NLIKE must be strings
  if (op === "LIKE" || op === "NLIKE") {
    if (typeof opVal !== "string")
      return { ok: false, reason: "Expected a string pattern" };
    return { ok: true, value: opVal };
  }

  // BEFORE / AFTER are date-like
  if (op === "BEFORE" || op === "AFTER") {
    const d = coerceDateToIso(opVal);
    if (!d.ok) return { ok: false, reason: d.reason };
    return { ok: true, value: d.value };
  }

  // Comparators / EQ / NEQ type-specific
  if (fieldType === "string") {
    if (typeof opVal !== "string")
      return { ok: false, reason: "Expected a string" };
    return { ok: true, value: opVal };
  }

  if (fieldType === "number") {
    if (typeof opVal !== "number" || Number.isNaN(opVal))
      return { ok: false, reason: "Expected a number" };
    return { ok: true, value: opVal };
  }

  if (fieldType === "boolean") {
    if (typeof opVal !== "boolean")
      return { ok: false, reason: "Expected a boolean" };
    return { ok: true, value: opVal };
  }

  if (fieldType === "date") {
    // allow date comparisons with ISO strings / Date objects
    const d = coerceDateToIso(opVal);
    if (!d.ok) return { ok: false, reason: d.reason };
    return { ok: true, value: d.value };
  }

  return { ok: false, reason: "Unsupported field type" };
};

/* ---------------------------- schema construction ---------------------------- */

const makeControlSchema = () => {
  const orderItemSchema = z.record(z.string(), z.enum(ORDER_DIRECTIONS));
  const orderSchema = z.union([orderItemSchema, z.array(orderItemSchema)]);

  return z.object({
    ORDER: orderSchema.optional(),
    LIMIT: z.number().int().positive().optional(),
    OFFSET: z.number().int().nonnegative().optional(),
  });
};

/**
 * Build a validator for the Search DSL that is configurable per endpoint/model.
 *
 * - Enforces: exactly one expression key (field or logical) per fragment
 * - Allows: control keys alongside the single expression key
 * - Validates: fields exist and operators are allowed for their types
 * - Validates: operator values match field type
 * - Normalizes: date values to ISO strings
 *
 * @param {FieldDefs} fieldDefs
 */
export const createSearchDslParser = (fieldDefs) => {
  const fieldNames = Object.keys(fieldDefs);

  const controlSchema = makeControlSchema();

  /** @type {(field: string) => string[]} */
  const allowedOperatorsForField = (field) => {
    const def = fieldDefs[field];
    if (!def) return [];
    if (def.operators && Array.isArray(def.operators)) return def.operators;
    return OPERATORS_BY_TYPE[def.type] ?? [];
  };

  /**
   * Returns the single "expression key" in a fragment (excluding control keys),
   * or null if invalid.
   * @param {Record<string, unknown>} obj
   */
  const getExpressionKey = (obj) => {
    const keys = Object.keys(obj);
    const exprKeys = keys.filter((k) => !CONTROL_KEYS.includes(k));
    if (exprKeys.length !== 1) return null;
    return exprKeys[0];
  };

  /**
   * Parse an expression fragment into a normalized AST-like node.
   * This is what you should pass downstream to compilers (SQL, Drizzle, Prisma).
   *
   * Node shapes:
   * - { kind: "and"|"or", items: Node[] }
   * - { kind: "not", item: Node }
   * - { kind: "field", field: string, ops: Array<{ op: string, value: any }> }
   *
   * @param {unknown} input
   * @param {Array<string|number>} path
   * @returns {any}
   */
  const parseNode = (input, path = []) => {
    if (!isPlainObject(input)) {
      throw new SearchDslError(
        "Invalid search DSL fragment (expected an object)",
        {
          code: "DSL_INVALID_FRAGMENT",
          path,
          message: `Expected object, got ${valueKind(input)}`,
        },
      );
    }

    // Validate control keys shape if present
    const controlCheck = controlSchema.safeParse(input);
    if (!controlCheck.success) {
      throw new SearchDslError("Invalid control keys in search DSL", {
        code: "DSL_INVALID_CONTROL_KEYS",
        path,
        message:
          controlCheck.error.issues[0]?.message ?? "Invalid control keys",
        issues: controlCheck.error.issues.map((i) => ({
          path: [...path, ...i.path],
          message: i.message,
        })),
      });
    }

    const exprKey = getExpressionKey(input);
    if (!exprKey) {
      throw new SearchDslError(
        "A search fragment must contain exactly one logical or field expression",
        {
          code: "DSL_INVALID_FRAGMENT_SHAPE",
          path,
          message:
            "Expected exactly one expression key (field or logical) plus optional control keys",
        },
      );
    }

    const value = /** @type {any} */ (input)[exprKey];

    // Logical operators
    if (LOGICAL_KEYS.includes(exprKey)) {
      if (exprKey === "NOT") {
        if (Array.isArray(value)) {
          throw new SearchDslError("NOT accepts exactly one expression", {
            code: "DSL_NOT_ARRAY",
            path: [...path, "NOT"],
            message: "NOT cannot receive an array",
          });
        }
        const item = parseNode(value, [...path, "NOT"]);
        return { kind: "not", item };
      }

      if (!Array.isArray(value) || value.length === 0) {
        throw new SearchDslError(`${exprKey} must be a non-empty array`, {
          code: "DSL_LOGICAL_ARRAY_REQUIRED",
          path: [...path, exprKey],
          message: `${exprKey} must be a non-empty array`,
        });
      }

      const items = value.map((v, i) => parseNode(v, [...path, exprKey, i]));
      return { kind: exprKey.toLowerCase(), items };
    }

    // Field expression
    const field = exprKey;
    if (!fieldNames.includes(field)) {
      throw new SearchDslError(`Unknown field '${field}'`, {
        code: "DSL_UNKNOWN_FIELD",
        path: [...path, field],
        message: `Field '${field}' is not allowed here`,
        allowedFields: fieldNames,
      });
    }

    if (!isPlainObject(value)) {
      throw new SearchDslError(
        `Field '${field}' must contain an operator object`,
        {
          code: "DSL_FIELD_EXPECTED_OBJECT",
          path: [...path, field],
          message: `Expected operator object, got ${valueKind(value)}`,
        },
      );
    }

    const fieldType = fieldDefs[field].type;
    const allowedOps = allowedOperatorsForField(field);

    // Support field-local AND/OR combining operator clauses
    // Example:
    // { createdAt: { AND: [ { BEFORE: "..." }, { AFTER: "..." } ] } }
    if ("AND" in value || "OR" in value) {
      const key = "AND" in value ? "AND" : "OR";
      const arr = value[key];
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new SearchDslError(
          `${key} inside field '${field}' must be a non-empty array`,
          {
            code: "DSL_FIELD_LOGICAL_ARRAY_REQUIRED",
            path: [...path, field, key],
            message: `${key} inside field '${field}' must be a non-empty array`,
          },
        );
      }

      // each element must be an operator object like { BEFORE: "..." }
      const items = arr.map((opObj, i) => {
        if (!isPlainObject(opObj)) {
          throw new SearchDslError(
            `Invalid operator clause for field '${field}'`,
            {
              code: "DSL_FIELD_OPERATOR_CLAUSE_INVALID",
              path: [...path, field, key, i],
              message: `Expected object, got ${valueKind(opObj)}`,
            },
          );
        }
        const opKeys = Object.keys(opObj);
        if (opKeys.length !== 1) {
          throw new SearchDslError(
            `Operator clause for field '${field}' must contain exactly one operator`,
            {
              code: "DSL_FIELD_OPERATOR_CLAUSE_SHAPE",
              path: [...path, field, key, i],
              message: "Expected exactly one operator key",
            },
          );
        }

        const op = opKeys[0];
        const opVal = opObj[op];

        if (!allowedOps.includes(op)) {
          throw new SearchDslError(
            `Operator '${op}' not allowed for field '${field}' (${fieldType})`,
            {
              code: "DSL_OPERATOR_NOT_ALLOWED",
              path: [...path, field, key, i, op],
              message: `Allowed operators: ${allowedOps.join(", ")}`,
              field,
              fieldType,
              operator: op,
              allowedOperators: allowedOps,
            },
          );
        }

        const vv = validateOperatorValue(fieldType, op, opVal);
        if (!vv.ok) {
          throw new SearchDslError(
            `Invalid value for operator '${op}' on field '${field}'`,
            {
              code: "DSL_OPERATOR_VALUE_INVALID",
              path: [...path, field, key, i, op],
              message: vv.reason,
              field,
              fieldType,
              operator: op,
            },
          );
        }

        return { kind: "field", field, ops: [{ op, value: vv.value }] };
      });

      return { kind: key.toLowerCase(), items };
    }

    // Normal operator object (possibly multiple operators)
    const ops = [];
    for (const [op, opVal] of Object.entries(value)) {
      if (!allowedOps.includes(op)) {
        throw new SearchDslError(
          `Operator '${op}' not allowed for field '${field}' (${fieldType})`,
          {
            code: "DSL_OPERATOR_NOT_ALLOWED",
            path: [...path, field, op],
            message: `Allowed operators: ${allowedOps.join(", ")}`,
            field,
            fieldType,
            operator: op,
            allowedOperators: allowedOps,
          },
        );
      }

      const vv = validateOperatorValue(fieldType, op, opVal);
      if (!vv.ok) {
        throw new SearchDslError(
          `Invalid value for operator '${op}' on field '${field}'`,
          {
            code: "DSL_OPERATOR_VALUE_INVALID",
            path: [...path, field, op],
            message: vv.reason,
            field,
            fieldType,
            operator: op,
          },
        );
      }

      ops.push({ op, value: vv.value });
    }

    if (ops.length === 0) {
      throw new SearchDslError(
        `Field '${field}' must include at least one operator`,
        {
          code: "DSL_FIELD_NO_OPERATORS",
          path: [...path, field],
          message: "Operator object was empty",
        },
      );
    }

    return { kind: "field", field, ops };
  };

  /**
   * Parse the entire DSL including control keys. Control keys are returned separately.
   * @param {unknown} dsl
   */
  const parse = (dsl) => {
    const root = parseNode(dsl, []);

    // Root control keys already validated in parseNode()
    const { ORDER, LIMIT, OFFSET } = /** @type {any} */ (dsl);
    const control = { ORDER, LIMIT, OFFSET };

    // Normalize ORDER into array form for downstream compilers
    let order = [];
    if (ORDER) {
      if (Array.isArray(ORDER)) order = ORDER;
      else order = [ORDER];
    }

    return {
      root,
      control: {
        order,
        limit: LIMIT ?? undefined,
        offset: OFFSET ?? undefined,
      },
      // convenience: echo allowed fields/types for debugging
      meta: {
        allowedFields: fieldNames,
      },
    };
  };

  return { parse };
};

/* ------------------------------ convenience API ------------------------------ */

/**
 * Convenience one-shot parse.
 * @param {unknown} dsl
 * @param {FieldDefs} fieldDefs
 */
export const parseSearchDsl = (dsl, fieldDefs) => {
  const parser = createSearchDslParser(fieldDefs);
  return parser.parse(dsl);
};

/* --------------------------------- formatting -------------------------------- */

/**
 * Pretty-print a SearchDslError (useful for logs and API responses).
 * @param {unknown} err
 */
export const formatSearchDslError = (err) => {
  if (!(err instanceof SearchDslError)) return null;

  const issues =
    err.details?.issues ??
    (err.details?.path
      ? [
          {
            path: err.details.path,
            message: err.details.message ?? err.message,
          },
        ]
      : []);

  const humanLines = [];
  humanLines.push(err.message);

  for (const issue of issues) {
    humanLines.push(`- ${pathToString(issue.path)}: ${issue.message}`);
  }

  return {
    human: humanLines.join("\n"),
    machine: {
      name: err.name,
      message: err.message,
      ...err.details,
      issues: issues.map((i) => ({
        ...i,
        pathString: pathToString(i.path),
      })),
    },
  };
};
