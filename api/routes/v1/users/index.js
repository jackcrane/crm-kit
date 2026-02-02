import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  not,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../../util/db.js";
import { usersTable } from "../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../util/entitlements.js";
import {
  SearchDslError,
  formatSearchDslError,
  parseSearchDsl,
} from "../../../util/search-dsl.js";
import { toPublicUser, userColumnMap } from "../../../util/users.js";

const MAX_LIMIT = 100;
const BASIC_SEARCH_FIELDS = ["email", "name", "id"];

const userSearchFields = {
  id: { type: "string" },
  email: { type: "string" },
  name: { type: "string" },
  status: { type: "string", operators: ["EQ", "NEQ", "IN", "NIN"] },
  createdAt: { type: "date" },
  updatedAt: { type: "date" },
};

const isDateField = (field) => field === "createdAt" || field === "updatedAt";

function normalizeFieldValue(field, value) {
  if (!isDateField(field)) return value;
  return new Date(value);
}

function buildFieldPredicate(field, op, value) {
  const column = userColumnMap[field];
  const typedValue = normalizeFieldValue(field, value);

  switch (op) {
    case "EQ":
      return eq(column, typedValue);
    case "NEQ":
      return not(eq(column, typedValue));
    case "LT":
    case "BEFORE":
      return lt(column, typedValue);
    case "LTE":
      return lte(column, typedValue);
    case "GT":
    case "AFTER":
      return gt(column, typedValue);
    case "GTE":
      return gte(column, typedValue);
    case "IN":
      return inArray(column, typedValue);
    case "NIN":
      return notInArray(column, typedValue);
    case "LIKE":
      return ilike(column, typedValue);
    case "NLIKE":
      return not(ilike(column, typedValue));
    default:
      throw new SearchDslError(`Unsupported operator '${op}'`, {
        code: "DSL_OPERATOR_NOT_SUPPORTED",
        field,
        operator: op,
      });
  }
}

function compileUserDslNode(node) {
  switch (node.kind) {
    case "field": {
      const predicates = node.ops.map((op) =>
        buildFieldPredicate(node.field, op.op, op.value),
      );
      return predicates.length === 1 ? predicates[0] : and(...predicates);
    }
    case "and": {
      const clauses = node.items.map(compileUserDslNode);
      return clauses.length === 1 ? clauses[0] : and(...clauses);
    }
    case "or": {
      const clauses = node.items.map(compileUserDslNode);
      return clauses.length === 1 ? clauses[0] : or(...clauses);
    }
    case "not":
      return not(compileUserDslNode(node.item));
    default:
      throw new SearchDslError("Unknown search DSL node", {
        code: "DSL_UNKNOWN_NODE_KIND",
        kind: node.kind,
      });
  }
}

function compileUserOrder(orderItems = []) {
  const compiled = [];

  for (const orderItem of orderItems) {
    for (const [field, direction] of Object.entries(orderItem)) {
      const column = userColumnMap[field];
      if (!column) {
        throw new SearchDslError(`Unknown ORDER field '${field}'`, {
          code: "DSL_ORDER_FIELD_UNKNOWN",
          field,
          allowedFields: Object.keys(userColumnMap),
        });
      }

      compiled.push(direction === "DESC" ? desc(column) : asc(column));
    }
  }

  return compiled;
}

function parseUserSearchDsl(rawDsl) {
  if (rawDsl === undefined) return null;

  let dslPayload = rawDsl;
  if (typeof rawDsl === "string") {
    try {
      dslPayload = JSON.parse(rawDsl);
    } catch (err) {
      throw new SearchDslError("searchDsl must be valid JSON", {
        code: "DSL_INVALID_JSON",
        message: err.message,
      });
    }
  }

  return parseSearchDsl(dslPayload, userSearchFields);
}

function parseSearchFields(rawSearchFields) {
  if (!rawSearchFields) return BASIC_SEARCH_FIELDS;

  const fields = String(rawSearchFields)
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  if (fields.length === 0) return BASIC_SEARCH_FIELDS;

  const invalid = fields.filter((f) => !BASIC_SEARCH_FIELDS.includes(f));
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported searchFields: ${invalid.join(", ")}. Allowed: ${BASIC_SEARCH_FIELDS.join(", ")}`,
    );
  }

  return fields;
}

function buildSearchPredicate(search, fields) {
  if (!search) return null;
  const term = `%${search}%`;
  const clauses = fields.map((field) => ilike(userColumnMap[field], term));
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

export const get = [
  requireEntitlements(["users:read"]),
  async (req, res) => {
    let parsedSearch = null;
    try {
      parsedSearch = parseUserSearchDsl(req.query.searchDsl);
    } catch (err) {
      const formatted = formatSearchDslError(err);
      if (!formatted) throw err;
      return res.status(400).json({
        status: "failure",
        reason: "invalid_search_dsl",
        message: formatted.human,
        error: formatted.machine,
      });
    }

    let searchFields = BASIC_SEARCH_FIELDS;
    try {
      searchFields = parseSearchFields(req.query.searchFields);
    } catch (err) {
      return res.status(400).json({
        status: "failure",
        reason: "invalid_search_fields",
        message: err.message,
      });
    }

    const page = Number.parseInt(req.query.page ?? "1", 10) || 1;
    const limitRaw = Number.parseInt(req.query.limit ?? "10", 10) || 10;
    const limit = Math.min(Math.max(limitRaw, 1), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const compiledFilters = parsedSearch
      ? compileUserDslNode(parsedSearch.root)
      : null;
    const basicSearch = buildSearchPredicate(req.query.search, searchFields);

    const whereConditions = [
      eq(usersTable.applicationId, req.applicationId),
      compiledFilters,
      basicSearch,
    ].filter(Boolean);

    const whereClause =
      whereConditions.length === 1
        ? whereConditions[0]
        : and(...whereConditions);

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(usersTable)
      .where(whereClause);

    const orderBy =
      parsedSearch && parsedSearch.control.order
        ? compileUserOrder(parsedSearch.control.order)
        : [];

    const users = await db
      .select()
      .from(usersTable)
      .where(whereClause)
      .orderBy(...(orderBy.length ? orderBy : [desc(usersTable.createdAt)]))
      .limit(limit)
      .offset(offset);

    return res.json({
      users: users.map(toPublicUser),
      total: Number(count),
      page,
      limit,
    });
  },
];
