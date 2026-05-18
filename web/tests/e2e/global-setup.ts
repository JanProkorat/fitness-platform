/**
 * Playwright global setup — resets the compose harness DB to the seeded baseline
 * before any spec runs. This ensures each CI run starts from a clean, deterministic
 * fixture state regardless of what a previous run may have written.
 *
 * The backend's POST /test/reset endpoint (added in the backend slice of #268)
 * calls QaSeedRunner.ResetAsync which truncates dynamic tables and re-seeds the
 * deterministic QA users. It returns 204 No Content on success.
 *
 * TLS note: the compose harness uses a self-signed dev cert. We configure the
 * Node https agent to skip certificate verification (rejectUnauthorized: false).
 * This is safe for the test harness running on localhost only.
 */

import https from 'node:https';

const BASE_URL = process.env['E2E_API_URL'] ?? 'https://localhost:5101';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resetDb(attempt: number): Promise<void> {
  const url = `${BASE_URL}/test/reset`;

  return new Promise<void>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        rejectUnauthorized: false,
        headers: { 'Content-Length': '0' },
      },
      (res) => {
        // Drain the response body so the socket is freed
        res.resume();
        if (res.statusCode === 204) {
          resolve();
        } else {
          reject(
            new Error(
              `POST ${url} returned HTTP ${res.statusCode}. ` +
                `Expected 204. (attempt ${attempt}/${MAX_RETRIES})`,
            ),
          );
        }
      },
    );

    req.on('error', (err) => {
      reject(
        new Error(
          `POST ${url} network error: ${err.message} (attempt ${attempt}/${MAX_RETRIES})`,
        ),
      );
    });

    req.end();
  });
}

export default async function globalSetup(): Promise<void> {
  console.log(`[global-setup] Resetting compose harness DB at ${BASE_URL}/test/reset …`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await resetDb(attempt);
      console.log('[global-setup] DB reset successful — fixture is at seeded baseline.');
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `[global-setup] DB reset failed after ${MAX_RETRIES} attempts. ` +
            `Is the compose harness running? (npm run e2e:up)\n` +
            `Last error: ${message}`,
        );
      }
      console.warn(
        `[global-setup] Reset attempt ${attempt}/${MAX_RETRIES} failed: ${message}. ` +
          `Retrying in ${RETRY_DELAY_MS}ms …`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}
