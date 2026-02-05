import { and, eq } from "drizzle-orm";
import { db } from "../../../util/db.js";
import { peopleTable } from "../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../util/entitlements.js";
import { fetchPeopleRelations, toPublicPerson } from "../../../util/people.js";

const errors = {
  person_not_found: {
    status: "failure",
    reason: "person_not_found",
    message: "Person not found.",
  },
};

async function findPerson(personId, applicationId) {
  const [person] = await db
    .select()
    .from(peopleTable)
    .where(
      and(eq(peopleTable.id, personId), eq(peopleTable.applicationId, applicationId)),
    )
    .limit(1);

  return person ?? null;
}

export const get = [
  requireEntitlements(["people:read"]),
  async (req, res) => {
    const person = await findPerson(req.params.personId, req.applicationId);

    if (!person) {
      return res.status(404).json(errors.person_not_found);
    }

    const hasContactEntitlement =
      req.user?.entitlements?.includes("superuser") ||
      req.user?.entitlements?.includes("people.contact:read");
    const hasFinancialEntitlement =
      req.user?.entitlements?.includes("superuser") ||
      req.user?.entitlements?.includes("people.financial:read");

    const relations = await fetchPeopleRelations([person.id], req.applicationId);

    return res.status(200).json({
      person: toPublicPerson(person, {
        canSeeFinancial: hasFinancialEntitlement,
        canSeeContact: hasContactEntitlement,
        emails: relations.emailsByPerson.get(person.id) ?? [],
        phones: relations.phonesByPerson.get(person.id) ?? [],
        fieldValues: relations.fieldValuesByPerson.get(person.id) ?? [],
        fieldDefs: relations.fieldDefs,
        user: req.user,
      }),
    });
  },
];
