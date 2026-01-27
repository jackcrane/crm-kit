import z from "zod";
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
import { db } from "../../../../util/db.js";
import { invitationsTable } from "../../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../../util/entitlements.js";
import {
  expirePendingInvitations,
  generateInvitationCode,
  toPublicInvitation,
} from "../../../../util/invitations.js";
import {
  SearchDslError,
  formatSearchDslError,
  parseSearchDsl,
} from "../../../../util/search-dsl.js";

const MAX_LIMIT = 100;
const BASIC_SEARCH_FIELDS = ["email", "name", "code", "id"];

const invitationInputSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
  entitlements: z.array(z.string()).optional().default([]),
  message: z.string().optional(),
  ctaUrl: z.string().optional(),
});

function normalizePayload(body) {
  const arrayPayload = Array.isArray(body) ? body : [body];
  return arrayPayload.map((item) => invitationInputSchema.parse(item));
}

async function expireOldInvitations(applicationId) {
  await expirePendingInvitations(applicationId);
}

const invitationSearchFields = {
  id: { type: "string" },
  email: { type: "string" },
  name: { type: "string" },
  code: { type: "string" },
  status: { type: "string", operators: ["EQ", "NEQ", "IN", "NIN"] },
  createdAt: { type: "date" },
  updatedAt: { type: "date" },
};

const invitationColumnMap = {
  id: invitationsTable.id,
  email: invitationsTable.email,
  name: invitationsTable.name,
  code: invitationsTable.code,
  status: invitationsTable.status,
  createdAt: invitationsTable.createdAt,
  updatedAt: invitationsTable.updatedAt,
};

const isDateField = (field) => field === "createdAt" || field === "updatedAt";

function normalizeFieldValue(field, value) {
  if (!isDateField(field)) return value;
  return new Date(value);
}

function buildFieldPredicate(field, op, value) {
  const column = invitationColumnMap[field];
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

function compileInvitationDslNode(node) {
  switch (node.kind) {
    case "field": {
      const predicates = node.ops.map((op) =>
        buildFieldPredicate(node.field, op.op, op.value),
      );
      return predicates.length === 1 ? predicates[0] : and(...predicates);
    }

    case "and": {
      const clauses = node.items.map(compileInvitationDslNode);
      return clauses.length === 1 ? clauses[0] : and(...clauses);
    }

    case "or": {
      const clauses = node.items.map(compileInvitationDslNode);
      return clauses.length === 1 ? clauses[0] : or(...clauses);
    }

    case "not":
      return not(compileInvitationDslNode(node.item));

    default:
      throw new SearchDslError("Unknown search DSL node", {
        code: "DSL_UNKNOWN_NODE_KIND",
        kind: node.kind,
      });
  }
}

function compileInvitationOrder(orderItems = []) {
  const compiled = [];

  for (const orderItem of orderItems) {
    for (const [field, direction] of Object.entries(orderItem)) {
      const column = invitationColumnMap[field];
      if (!column) {
        throw new SearchDslError(`Unknown ORDER field '${field}'`, {
          code: "DSL_ORDER_FIELD_UNKNOWN",
          field,
          allowedFields: Object.keys(invitationColumnMap),
        });
      }

      compiled.push(direction === "DESC" ? desc(column) : asc(column));
    }
  }

  return compiled;
}

function parseInvitationSearchDsl(rawDsl) {
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

  return parseSearchDsl(dslPayload, invitationSearchFields);
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
  const clauses = fields.map((field) => ilike(invitationColumnMap[field], term));
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

export const post = [
  requireEntitlements(["invitations:write"]),
  async (req, res) => {
    let payloads;
    try {
      payloads = normalizePayload(req.body);
    } catch (err) {
      return res.status(400).json({
        status: "failure",
        reason: "invalid_submission_format",
        message: err.message,
      });
    }

    const invitations = [];

    for (const payload of payloads) {
      // If a rescinded invitation exists for this email/app, reuse it.
      const [existingRescinded] = await db
        .select()
        .from(invitationsTable)
        .where(
          and(
            eq(invitationsTable.applicationId, req.applicationId),
            eq(invitationsTable.email, payload.email),
            eq(invitationsTable.status, "rescinded"),
          ),
        )
        .orderBy(desc(invitationsTable.updatedAt))
        .limit(1);

      if (existingRescinded) {
        const [updated] = await db
          .update(invitationsTable)
          .set({
            name: payload.name ?? existingRescinded.name,
            entitlements: payload.entitlements ?? [],
            code: generateInvitationCode(),
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(invitationsTable.id, existingRescinded.id))
          .returning();

        invitations.push(updated);
        continue;
      }

      const [inserted] = await db
        .insert(invitationsTable)
        .values({
          applicationId: req.applicationId,
          email: payload.email,
          name: payload.name,
          entitlements: payload.entitlements ?? [],
          code: generateInvitationCode(),
        })
        .returning();

      invitations.push(inserted);
    }

    return res.status(201).json({
      status: "success",
      invitations: invitations.map((inv) => ({
        ...toPublicInvitation(inv),
        code: inv.code,
        entitlements: inv.entitlements,
      })),
    });
  },
];

export const get = [
  requireEntitlements(["invitations:read"]),
  async (req, res) => {
    await expireOldInvitations(req.applicationId);

    let parsedSearch = null;
    try {
      parsedSearch = parseInvitationSearchDsl(req.query.searchDsl);
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
      ? compileInvitationDslNode(parsedSearch.root)
      : null;
    const basicSearch = buildSearchPredicate(req.query.search, searchFields);

    const whereConditions = [
      eq(invitationsTable.applicationId, req.applicationId),
      compiledFilters,
      basicSearch,
    ].filter(Boolean);

    const whereClause =
      whereConditions.length === 1
        ? whereConditions[0]
        : and(...whereConditions);

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(invitationsTable)
      .where(whereClause);

    const orderBy =
      parsedSearch && parsedSearch.control.order
        ? compileInvitationOrder(parsedSearch.control.order)
        : [];

    const invitations = await db
      .select()
      .from(invitationsTable)
      .where(whereClause)
      .orderBy(...(orderBy.length ? orderBy : [desc(invitationsTable.createdAt)]))
      .limit(limit)
      .offset(offset);

    return res.json({
      invitations: invitations.map(toPublicInvitation),
      total: Number(count),
      page,
      limit,
    });
  },
];
