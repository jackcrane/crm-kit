import { spawn } from "child_process";
import { once } from "events";
import { setTimeout as delay } from "timers/promises";

const PORT = process.env.PORT || "3000";
const BASE_URL =
  process.env.TEST_BASE_URL || `http://127.0.0.1:${PORT}`;

async function waitForServerReadiness(retries = 30) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(BASE_URL, {
        headers: { "x-application-id": "placeholder" },
      });
      if (response.ok || response.status >= 400) {
        return;
      }
    } catch (err) {
      // swallow to retry
    }
    await delay(500);
  }
  throw new Error("API server did not become ready in time");
}

export async function startTestServer() {
  const serverProcess = spawn("node", ["index.js"], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: "inherit",
  });

  await waitForServerReadiness();

  return {
    baseUrl: BASE_URL,
    stop: async () => {
      serverProcess.kill("SIGTERM");
      await once(serverProcess, "exit");
    },
  };
}
