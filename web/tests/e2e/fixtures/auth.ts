/**
 * #897 — per-attempt refresh-token isolation for the trainer and
 * nutritionist Playwright projects.
 *
 * Root cause: every trainer/nutritionist spec previously shared ONE refresh
 * token via storageState: '.auth/<role>.json', written once by auth.setup.ts
 * before any spec ran. RefreshTokenEndpoint.cs rotates that token on every
 * restoreSession() call and — correctly — treats a replay of an
 * already-rotated token as theft once DefaultGraceWindowSeconds (20s) has
 * elapsed, revoking the whole token family. With retries: 2 in CI, a genuine
 * failure in an early spec can burn >20s across its attempts, so a LATER
 * spec's restoreSession() call replays a token an earlier spec already
 * rotated, gets treated as theft, and silently lands on /login — surfacing
 * as a confusing "element not found" failure with no auth signal at all.
 * See the #897 issue body for the full reproduction.
 *
 * Fix: override Playwright's built-in `storageState` fixture. Left at its
 * default scope ('test' — re-created for every test ATTEMPT, including each
 * retry), it mints a brand-new refresh token via POST /auth/login
 * immediately before the browser context for THIS attempt is created. A
 * token minted for one attempt is never handed to another attempt, so the
 * replay this bug depends on cannot happen — true at any `workers` count,
 * and unlike the on-disk file, never goes stale between the moment it's
 * written and the moment a spec's restoreSession() call consumes it.
 *
 * Two things this fixture deliberately does NOT rely on — see the #897
 * design review, which rejected both:
 *
 * - This is NOT "one token per worker" or "one token per spec file". A
 *   worker-scoped fixture is created once per worker and is NOT re-created
 *   for a retry of the same test within that worker, so attempts 2 and 3 of
 *   a failing spec would replay the token attempt 1 already consumed — the
 *   exact bug, unchanged, at workers: 1. Only per-ATTEMPT (test-scoped)
 *   granularity closes this.
 * - This does NOT work because separate logins get separate "token
 *   families". RefreshTokenEndpoint.cs's HandleRevokedTokenAsync calls
 *   RevokeRefreshTokenFamilyAsync(token.UserId, ...) — "family" is scoped to
 *   the USER, not to a login lineage, and every trainer spec authenticates
 *   as the same qa.trainer@fitnessplatform.test user (same for
 *   qa.nutri@fitnessplatform.test). Two independently-minted tokens for
 *   that user are NOT isolated from each other by the backend; this fix
 *   works only because a per-attempt token is never replayed, so the
 *   theft-detection branch never fires in the first place. If a future test
 *   ever opens a SECOND browser context inside one test attempt, it would
 *   reintroduce this exact cascade between those two contexts — mint a
 *   token per context in that case, not just per test.
 *
 * Rate-limit note: POST /auth/login is gated by AppPolicies.AuthRateLimit.
 * Per-attempt login is safe against the compose harness because
 * docker-compose.test.yml sets RateLimiting__Disabled=true for the api
 * service; it WOULD 429 if this suite were ever re-pointed at the
 * interactive dev API on :5001, where that limiter is active.
 */
import { test as base } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type Role = 'trainer' | 'nutritionist';

const ROLE_EMAILS: Record<Role, string> = {
  trainer: 'qa.trainer@fitnessplatform.test',
  nutritionist: 'qa.nutri@fitnessplatform.test',
};

interface LoginResponseBody {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  emailConfirmed: boolean;
}

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

interface OriginLocalStorageEntry {
  name: string;
  value: string;
}

interface StorageStateOrigin {
  origin: string;
  localStorage: OriginLocalStorageEntry[];
}

interface StorageStateTemplate {
  cookies: StoredCookie[];
  origins: StorageStateOrigin[];
}

/**
 * Builds a role-scoped `test` whose `storageState` fixture mints a fresh
 * refresh token for THIS test attempt instead of reusing the single shared
 * token auth.setup.ts wrote to `.auth/<role>.json`. That file is still
 * produced by auth.setup.ts (see playwright.config.ts's `setup` project,
 * which stays required — the client project and the interactive-QA
 * playbook in .claude/CLAUDE.md still consume it) and is used here purely
 * as a template: it supplies the non-auth parts of storage state (the
 * `gf-dark-mode` preference, the Google `g_state` cookie) that have nothing
 * to do with this bug and would otherwise have to be reconstructed by hand.
 */
function buildRoleTest(role: Role) {
  return base.extend({
    storageState: async ({ request, baseURL }, use) => {
      const password = process.env['QA_SEED_PASSWORD'];

      if (!password) {
        throw new Error(
          '[auth fixture] QA_SEED_PASSWORD is not set. Copy .env.test.example ' +
            'to .env.test and fill it in before running Playwright.',
        );
      }

      const response = await request.post('/auth/login', {
        data: { email: ROLE_EMAILS[role], password },
      });

      if (!response.ok()) {
        // Throw loudly rather than handing back an empty/partial token: a
        // silently-broken login would still land the spec on /login and
        // reproduce the exact confusing "element not found" symptom this
        // issue is about, instead of surfacing as an auth diagnosis.
        throw new Error(
          `[auth fixture] POST /auth/login for role "${role}" returned ` +
            `${response.status()} ${response.statusText()}. Is the compose ` +
            'harness running (npm run e2e:up) and QA_SEED_PASSWORD set ' +
            'correctly?',
        );
      }

      const { refreshToken } = (await response.json()) as LoginResponseBody;

      const templatePath = path.resolve(`.auth/${role}.json`);
      const template = JSON.parse(
        await readFile(templatePath, 'utf-8'),
      ) as StorageStateTemplate;

      // Clone the template's cookies + non-auth localStorage untouched, and
      // replace only the refreshToken entry with the one THIS attempt just
      // minted. Rewrite the origin to the live baseURL fixture rather than
      // whatever origin auth.setup.ts happened to run under — this also
      // fixes the pre-existing http://localhost:5173 vs http://web:5173
      // mismatch baked into .auth/*.json for dockerised runs, as a side
      // effect of no longer reading a stale origin off disk.
      const origin = baseURL ?? 'http://localhost:5173';
      const localStorage = (template.origins[0]?.localStorage ?? []).map(
        (entry) =>
          entry.name === 'refreshToken' ? { ...entry, value: refreshToken } : entry,
      );

      // This `use` is Playwright's fixture teardown-boundary callback
      // (per-fixture setup/teardown split, see
      // https://playwright.dev/docs/test-fixtures), not a React hook.
      // eslint-plugin-react-hooks matches purely on the `use*` identifier
      // naming convention and has no way to tell the two apart; this file
      // has no React import and is never rendered.
      // eslint-disable-next-line react-hooks/rules-of-hooks -- see above
      await use({
        cookies: template.cookies,
        origins: [{ origin, localStorage }],
      });
    },
  });
}

/** Use in tests/e2e/trainer/*.spec.ts. */
export const trainerTest = buildRoleTest('trainer');

/** Use in tests/e2e/nutritionist/*.spec.ts. */
export const nutritionistTest = buildRoleTest('nutritionist');

export { expect } from '@playwright/test';
