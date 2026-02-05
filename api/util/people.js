import {
  peopleEmailAddressesTable,
  peopleFieldValuesTable,
  peopleFieldsTable,
  peoplePhoneNumbersTable,
} from "../db/schema.js";
import { db } from "./db.js";
import { asc, inArray, eq } from "drizzle-orm";

export function normalizeNotes(notes) {
  if (!notes || typeof notes !== "object") return {};
  return {
    type: notes.type ?? "plaintext",
    content: notes.content ?? "",
  };
}

export async function fetchPeopleRelations(personIds, applicationId) {
  if (!personIds.length) {
    return {
      emailsByPerson: new Map(),
      phonesByPerson: new Map(),
      fieldValuesByPerson: new Map(),
      fieldDefs: new Map(),
    };
  }

  const [emailRows, phoneRows, valueRows, fieldRows] = await Promise.all([
    db
      .select()
      .from(peopleEmailAddressesTable)
      .where(inArray(peopleEmailAddressesTable.personId, personIds))
      .orderBy(asc(peopleEmailAddressesTable.order), asc(peopleEmailAddressesTable.createdAt)),
    db
      .select()
      .from(peoplePhoneNumbersTable)
      .where(inArray(peoplePhoneNumbersTable.personId, personIds))
      .orderBy(asc(peoplePhoneNumbersTable.order), asc(peoplePhoneNumbersTable.createdAt)),
    db
      .select()
      .from(peopleFieldValuesTable)
      .where(inArray(peopleFieldValuesTable.personId, personIds)),
    db
      .select()
      .from(peopleFieldsTable)
      .where(eq(peopleFieldsTable.applicationId, applicationId)),
  ]);

  const emailsByPerson = new Map();
  for (const row of emailRows) {
    const list = emailsByPerson.get(row.personId) ?? [];
    list.push({
      address: row.address,
      order: row.order,
      notes: normalizeNotes(row.notes),
    });
    emailsByPerson.set(row.personId, list);
  }

  const phonesByPerson = new Map();
  for (const row of phoneRows) {
    const list = phonesByPerson.get(row.personId) ?? [];
    list.push({
      number: row.number,
      order: row.order,
      notes: normalizeNotes(row.notes),
    });
    phonesByPerson.set(row.personId, list);
  }

  const fieldDefs = new Map(
    fieldRows.map((f) => [
      f.id,
      {
        id: f.id,
        title: f.title,
        icon: f.icon,
        entitlements: f.entitlements ?? [],
      },
    ]),
  );

  const fieldValuesByPerson = new Map();
  for (const row of valueRows) {
    const list = fieldValuesByPerson.get(row.personId) ?? [];
    list.push({ fieldId: row.fieldId, value: row.value });
    fieldValuesByPerson.set(row.personId, list);
  }

  return { emailsByPerson, phonesByPerson, fieldValuesByPerson, fieldDefs };
}

export function presentFields(fieldValues = [], fieldDefs, user) {
  const result = [];
  const userEntitlements = user?.entitlements ?? [];
  const isSuperuser = userEntitlements.includes("superuser");
  for (const { fieldId, value } of fieldValues) {
    const def = fieldDefs.get(fieldId);
    if (!def) continue;

    const required = def.entitlements ?? [];
    const canRead =
      required.length === 0 ||
      isSuperuser ||
      required.every((ent) => userEntitlements.includes(ent));

    result.push({
      id: fieldId,
      value: canRead ? value ?? null : null,
      userCanRead: canRead,
    });
  }
  return result;
}

export function toPublicPerson(person, options) {
  const {
    canSeeFinancial = false,
    canSeeContact = false,
    fieldValues = [],
    fieldDefs = new Map(),
    emails = [],
    phones = [],
  } = options ?? {};

  const payload = {
    id: person.id,
    name: person.name,
  };

  if (canSeeFinancial && person.ltv !== null && person.ltv !== undefined) {
    payload.ltv = Number(person.ltv);
  }

  const presentedFields = presentFields(fieldValues, fieldDefs, options?.user);
  if (presentedFields.length > 0) {
    payload.fields = presentedFields;
  } else {
    payload.fields = [];
  }

  if (canSeeContact) {
    payload.emailAddresses = emails ?? [];
    payload.phoneNumbers = phones ?? [];
  }

  return payload;
}
