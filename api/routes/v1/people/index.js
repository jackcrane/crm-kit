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
  or,
  sql,
  exists,
} from "drizzle-orm";
import { db } from "../../../util/db.js";
import {
  peopleTable,
  peopleEmailAddressesTable,
  peoplePhoneNumbersTable,
} from "../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../util/entitlements.js";
import {
  SearchDslError,
  formatSearchDslError,
  parseSearchDsl,
} from "../../../util/search-dsl.js";
import { fetchPeopleRelations, toPublicPerson } from "../../../util/people.js";

const MAX_LIMIT = 100;
const BASIC_SEARCH_FIELDS = ["name", "email", "phone", "id"];

const peopleColumnMap = {
  id: peopleTable.id,
  name: peopleTable.name,
  ltv: peopleTable.ltv,
  createdAt: peopleTable.createdAt,
  updatedAt: peopleTable.updatedAt,
};

const peopleSearchFields = {
  id: { type: "string" },
  email: { type: "string" },
  phone: { type: "string" },
  name: { type: "string" },
  ltv: { type: "number" },
  createdAt: { type: "date" },
  updatedAt: { type: "date" },
};

const isDateField = (field) => field === "createdAt" || field === "updatedAt";

function normalizeFieldValue(field, value) {
  if (!isDateField(field)) return value;
  return new Date(value);
}

function buildScalarPredicate(field, op, value) {
  const column = peopleColumnMap[field];
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
      return not(inArray(column, typedValue));
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

function buildContactExistsPredicate(table, column, op, value) {
  switch (op) {
    case "EQ":
      return exists(
        db
          .select({ one: sql`1` })
          .from(table)
          .where(and(eq(table.personId, peopleTable.id), eq(column, value))),
      );
    case "NEQ":
      return not(
        exists(
          db
            .select({ one: sql`1` })
            .from(table)
            .where(and(eq(table.personId, peopleTable.id), eq(column, value))),
        ),
      );
    case "LIKE":
      return exists(
        db
          .select({ one: sql`1` })
          .from(table)
          .where(
            and(eq(table.personId, peopleTable.id), ilike(column, value)),
          ),
      );
    case "NLIKE":
      return not(
        exists(
          db
            .select({ one: sql`1` })
            .from(table)
            .where(
              and(eq(table.personId, peopleTable.id), ilike(column, value)),
            ),
        ),
      );
    case "IN":
      return exists(
        db
          .select({ one: sql`1` })
          .from(table)
          .where(
            and(eq(table.personId, peopleTable.id), inArray(column, value)),
          ),
      );
    case "NIN":
      return not(
        exists(
          db
            .select({ one: sql`1` })
            .from(table)
            .where(
              and(eq(table.personId, peopleTable.id), inArray(column, value)),
            ),
        ),
      );
    default:
      throw new SearchDslError(`Unsupported operator '${op}'`, {
        code: "DSL_OPERATOR_NOT_SUPPORTED",
        operator: op,
      });
  }
}

function buildFieldPredicate(field, op, value, canSearchContact) {
  if (field === "email") {
    if (!canSearchContact) return null;
    return buildContactExistsPredicate(
      peopleEmailAddressesTable,
      peopleEmailAddressesTable.address,
      op,
      value,
    );
  }
  if (field === "phone") {
    if (!canSearchContact) return null;
    return buildContactExistsPredicate(
      peoplePhoneNumbersTable,
      peoplePhoneNumbersTable.number,
      op,
      value,
    );
  }

  return buildScalarPredicate(field, op, value);
}

function compileDslNode(node, canSearchContact) {
  switch (node.kind) {
    case "field": {
      const predicates = node.ops
        .map((op) =>
          buildFieldPredicate(node.field, op.op, op.value, canSearchContact),
        )
        .filter(Boolean);
      if (predicates.length === 0) return null;
      return predicates.length === 1 ? predicates[0] : and(...predicates);
    }
    case "and": {
      const clauses = node.items
        .map((item) => compileDslNode(item, canSearchContact))
        .filter(Boolean);
      if (clauses.length === 0) return null;
      return clauses.length === 1 ? clauses[0] : and(...clauses);
    }
    case "or": {
      const clauses = node.items
        .map((item) => compileDslNode(item, canSearchContact))
        .filter(Boolean);
      if (clauses.length === 0) return null;
      return clauses.length === 1 ? clauses[0] : or(...clauses);
    }
    case "not": {
      const compiled = compileDslNode(node.item, canSearchContact);
      if (!compiled) return null;
      return not(compiled);
    }
    default:
      throw new SearchDslError("Unknown search DSL node", {
        code: "DSL_UNKNOWN_NODE_KIND",
        kind: node.kind,
      });
  }
}

function compileOrder(orderItems = []) {
  const compiled = [];

  for (const orderItem of orderItems) {
    for (const [field, direction] of Object.entries(orderItem)) {
      const column = peopleColumnMap[field];
      if (!column) {
        throw new SearchDslError(`Unknown ORDER field '${field}'`, {
          code: "DSL_ORDER_FIELD_UNKNOWN",
          field,
          allowedFields: Object.keys(peopleColumnMap),
        });
      }

      compiled.push(direction === "DESC" ? desc(column) : asc(column));
    }
  }

  return compiled;
}

function parsePeopleSearchDsl(rawDsl, canSearchContact) {
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

  const parsed = parseSearchDsl(dslPayload, peopleSearchFields);

  if (!canSearchContact) {
    // Remove any email/phone predicates by throwing if they were requested
    const containsContactFields = parsed.meta.allowedFields.some(
      (f) => f === "email" || f === "phone",
    );
    if (containsContactFields) {
      // do nothing special; compile step will drop them
    }
  }

  return parsed;
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

function buildSearchPredicate(search, fields, canSearchContact) {
  if (!search) return null;
  const term = `%${search}%`;

  const usableFields = fields.filter((f) =>
    f === "email" || f === "phone" ? canSearchContact : true,
  );

  const effectiveFields =
    usableFields.length > 0 ? usableFields : ["name", "id"];

  const clauses = effectiveFields.map((field) => {
    if (field === "email") {
      return exists(
        db
          .select({ one: sql`1` })
          .from(peopleEmailAddressesTable)
          .where(
            and(
              eq(peopleEmailAddressesTable.personId, peopleTable.id),
              ilike(peopleEmailAddressesTable.address, term),
            ),
          ),
      );
    }
    if (field === "phone") {
      return exists(
        db
          .select({ one: sql`1` })
          .from(peoplePhoneNumbersTable)
          .where(
            and(
              eq(peoplePhoneNumbersTable.personId, peopleTable.id),
              ilike(peoplePhoneNumbersTable.number, term),
            ),
          ),
      );
    }
    return ilike(peopleColumnMap[field], term);
  });

  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

export const get = [
  requireEntitlements(["people:read"]),
  async (req, res) => {
    const hasContactEntitlement =
      req.user?.entitlements?.includes("superuser") ||
      req.user?.entitlements?.includes("people.contact:read");
    const hasFinancialEntitlement =
      req.user?.entitlements?.includes("superuser") ||
      req.user?.entitlements?.includes("people.financial:read");

    let parsedSearch = null;
    try {
      parsedSearch = parsePeopleSearchDsl(
        req.query.searchDsl,
        hasContactEntitlement,
      );
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

    const compiledFilters =
      parsedSearch && parsedSearch.root
        ? compileDslNode(parsedSearch.root, hasContactEntitlement)
        : null;
    const basicSearch = buildSearchPredicate(
      req.query.search,
      searchFields,
      hasContactEntitlement,
    );

    const whereConditions = [
      eq(peopleTable.applicationId, req.applicationId),
      compiledFilters,
      basicSearch,
    ].filter(Boolean);

    const whereClause =
      whereConditions.length === 1
        ? whereConditions[0]
        : and(...whereConditions);

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(peopleTable)
      .where(whereClause);

    const orderBy =
      parsedSearch && parsedSearch.control.order
        ? compileOrder(parsedSearch.control.order)
        : [];

    const people = await db
      .select()
      .from(peopleTable)
      .where(whereClause)
      .orderBy(...(orderBy.length ? orderBy : [desc(peopleTable.createdAt)]))
      .limit(limit)
      .offset(offset);

    const ids = people.map((p) => p.id);
    const relations = await fetchPeopleRelations(ids, req.applicationId);

    return res.json({
      people: people.map((person) =>
        toPublicPerson(person, {
          canSeeFinancial: hasFinancialEntitlement,
          canSeeContact: hasContactEntitlement,
          emails: relations.emailsByPerson.get(person.id) ?? [],
          phones: relations.phonesByPerson.get(person.id) ?? [],
          fieldValues: relations.fieldValuesByPerson.get(person.id) ?? [],
          fieldDefs: relations.fieldDefs,
          user: req.user,
        }),
      ),
      total: Number(count),
      page,
      limit,
    });
  },
];
