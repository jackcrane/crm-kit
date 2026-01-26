import { execSync } from "child_process";
import path from "path";
import pg from "pg";
import { setTimeout as delay } from "timers/promises";

const composeFile = path.join(process.cwd(), "docker-compose.test.yml");
const defaultPort = process.env.TEST_DB_PORT || "5435";
const defaultDatabaseUrl = `postgres://postgres:postgres@127.0.0.1:${defaultPort}/crm_kit_test`;

let managedCompose = false;
let startPromise = null;

function usingComposeDb(url) {
  if (!url) {
    return false;
  }

  try {
    const { hostname } = new URL(url);
    return hostname === "db";
  } catch {
    return false;
  }
}

function runCompose(args) {
  execSync(`docker compose -f "${composeFile}" ${args.join(" ")}`, {
    stdio: "inherit",
  });
}

async function waitForDatabase(connectionString) {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const client = new pg.Client({ connectionString });
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      await delay(1000);
    }
  }

  throw new Error("Test database did not become ready in time");
}

export async function ensureTestDatabase() {
  if (usingComposeDb(process.env.DATABASE_URL)) {
    return;
  }

  process.env.DATABASE_URL = defaultDatabaseUrl;

  if (!startPromise) {
    startPromise = (async () => {
      runCompose(["up", "-d", "db"]);
      await waitForDatabase(process.env.DATABASE_URL);
      managedCompose = true;
    })();
  }

  return startPromise;
}

export async function shutdownTestDatabase() {
  if (!managedCompose) {
    return;
  }

  runCompose(["down", "-v"]);
}
