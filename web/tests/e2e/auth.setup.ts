/**
 * Playwright auth setup — logs each QA role in via POST /auth/login against
 * the compose harness and persists a synthesized storage state to
 * .auth/<role>.json.
 *
 * This runs once as a dependency before any spec project (trainer / client /
 * nutritionist). The `client` project reads .auth/client.json verbatim
 * (playwright.config.ts's `client` project `use.storageState`). The trainer
 * and nutritionist projects instead mint a fresh per-attempt token via
 * tests/e2e/fixtures/auth.ts and use this file's output only as a template
 * for the non-auth parts of storage state — see that file's header comment.
 *
 * v1 has no login page yet (epic sub-issue 1 builds it — design spec
 * docs/superpowers/specs/2026-09-14-web-v1-rebuild-design.md §5). This no
 * longer drives the /login form; it authenticates straight through the API:
 * POST /auth/login via Playwright's `request` fixture, then synthesize a
 * storage-state document with the returned refreshToken written into
 * localStorage under the app's own 'refreshToken' key — the same key
 * stores/auth.ts reads on startup. This mirrors the approach
 * tests/e2e/fixtures/auth.ts already uses per-test.
 *
 * Credentials come from QA_SEED_PASSWORD (env var, never hardcoded). Copy
 * .env.test.example to .env.test and set a value before running.
 *
 * The seeded emails are stable fixture constants defined in QaSeedRunner.cs:
 *   qa.trainer@fitnessplatform.test
 *   qa.client@fitnessplatform.test
 *   qa.nutri@fitnessplatform.test
 *
 * Error handling:
 *   - Missing QA_SEED_PASSWORD → fail fast with a clear message pointing at
 *     .env.test.example.
 *   - POST /auth/login failure (wrong password, harness down) → throw with a
 *     diagnostic BEFORE writing anything to disk. A half-written
 *     .auth/<role>.json would make every downstream spec fail as an
 *     unexplained "element not found" instead of a clear auth signal.
 */

import { test as setup } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROLES = [
  {
    role: 'trainer',
    email: 'qa.trainer@fitnessplatform.test',
    storageStatePath: path.resolve('.auth/trainer.json'),
  },
  {
    role: 'client',
    email: 'qa.client@fitnessplatform.test',
    storageStatePath: path.resolve('.auth/client.json'),
  },
  {
    role: 'nutritionist',
    email: 'qa.nutri@fitnessplatform.test',
    storageStatePath: path.resolve('.auth/nutritionist.json'),
  },
] as const;

interface LoginResponseBody {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  emailConfirmed: boolean;
}

for (const { role, email, storageStatePath } of ROLES) {
  setup(`authenticate as ${role}`, async ({ request, baseURL }) => {
    const password = process.env['QA_SEED_PASSWORD'];
    if (!password) {
      throw new Error(
        'QA_SEED_PASSWORD is not set. ' +
          'Copy .env.test.example to .env.test, fill it in, then ' +
          '`source .env.test` or load it with dotenv before running Playwright.',
      );
    }

    const response = await request.post('/auth/login', {
      data: { email, password },
    });

    if (!response.ok()) {
      throw new Error(
        `[auth-setup] POST /auth/login for role "${role}" returned ` +
          `${response.status()} ${response.statusText()}. Is the compose ` +
          'harness running (npm run e2e:up) and QA_SEED_PASSWORD set ' +
          'correctly?',
      );
    }

    const { refreshToken } = (await response.json()) as LoginResponseBody;

    // The client project (playwright.config.ts) reads .auth/client.json
    // verbatim, so the origin here must be the live baseURL fixture, never a
    // hardcoded localhost — it differs between host runs (localhost:5173)
    // and the dockerised qa-playwright container (http://web:5173).
    const origin = baseURL ?? 'http://localhost:5173';

    await mkdir(path.dirname(storageStatePath), { recursive: true });
    await writeFile(
      storageStatePath,
      JSON.stringify(
        {
          cookies: [],
          origins: [
            {
              origin,
              localStorage: [
                { name: 'refreshToken', value: refreshToken },
                { name: 'lang', value: 'en' },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );

    console.log(`[auth-setup] Saved ${role} storage state to ${storageStatePath}`);
  });
}
