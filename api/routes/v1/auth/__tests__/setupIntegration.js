import { afterAll, beforeAll, beforeEach } from "vitest";
import {
  migrateDatabase,
  resetDatabase,
  closeDatabaseConnections,
} from "../../../../tests/helpers/db.js";
import { startTestServer } from "../../../../tests/helpers/server.js";

let sharedServerPromise = null;
let stopRegistered = false;

export function useIntegrationServer() {
  const state = { server: null };

  beforeAll(async () => {
    if (!sharedServerPromise) {
      sharedServerPromise = (async () => {
        await migrateDatabase();
        await resetDatabase();
        return startTestServer();
      })();
    }

    state.server = await sharedServerPromise;
  });

  if (!stopRegistered) {
    stopRegistered = true;
    afterAll(async () => {
      if (sharedServerPromise) {
        const server = await sharedServerPromise;
        await server.stop();
      }
      await closeDatabaseConnections();
    });
  }

  beforeEach(async () => {
    await resetDatabase();
  });

  return state;
}
