import { applicationsTable, eventsTable, usersTable } from "../db/schema.js";
import { db } from "../util/db.js";
import bcrypt from "bcrypt";

db.transaction(async (tx) => {
  const [application] = await tx
    .insert(applicationsTable)
    .values({
      name: "CRM Kit Test App",
    })
    .returning();

  const [user] = await tx
    .insert(usersTable)
    .values({
      applicationId: application.id,
      name: "Jack Crane",
      email: "jack@jackcrane.rocks",
      password: bcrypt.hashSync("password", 10),
    })
    .returning();

  await tx.insert(eventsTable).values({
    userId: user.id,
    applicationId: application.id,
    type: "USER_CREATED",
  });

  console.log("Done");
});
