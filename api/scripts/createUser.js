import { eventsTable, usersTable } from "../db/schema.js";
import { db } from "../util/db.js";

db.transaction(async (tx) => {
  const [user] = await tx
    .insert(usersTable)
    .values({
      name: "Jack Crane",
      email: "jack@jackcrane.rocks",
      password: "asodfi9ais0df9ais0d9fipa0f-dsf",
    })
    .returning();

  await tx.insert(eventsTable).values({
    userId: user.id,
    type: "USER_CREATED",
  });

  console.log("Done");
});
