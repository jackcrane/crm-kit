import { afterAll, beforeAll, beforeEach } from "vitest";
import {
  migrateDatabase,
  resetDatabase,
  closeDatabaseConnections,
} from "../../../../tests/helpers/db.js";
import { startTestServer } from "../../../../tests/helpers/server.js";

export function useIntegrationServer() {
  const state = { server: null };

  beforeAll(async () => {
    await migrateDatabase();
    await resetDatabase();
    state.server = await startTestServer();
  });

  afterAll(async () => {
    if (state.server) {
      await state.server.stop();
    }
    await closeDatabaseConnections();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  return state;
}
