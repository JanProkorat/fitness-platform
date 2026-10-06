# qa-tester — Auto-provisioning test users

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

Two paths depending on which backend is up:

- **Compose harness up** (preferred) — log in directly as the seeded
  fixture (`docs/testing/e2e-fixtures.md`):
  `qa.client@fitnessplatform.test` / `QaPass123!` for client flows,
  `qa.trainer@fitnessplatform.test` for trainer flows,
  `qa.nutri@fitnessplatform.test` for nutritionist flows. Use this
  whenever an AC depends on pre-existing data.
- **Ad-hoc `dotnet run`** (fallback) — no real seeded users, only
  roles. Create a throwaway test account per run via
  `POST /auth/register`, then log in. Email confirmation is not
  enforced for login.

```bash
EMAIL="qa-auto-$(date +%s)@example.com"
PASS="TestPass123!"
# Role is one of: Client | Trainer | Nutritionist | Admin
ROLE="Trainer"

# Register
curl -ksS -X POST https://localhost:5001/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"confirmPassword\":\"$PASS\",\"firstName\":\"QA\",\"lastName\":\"Bot\",\"role\":\"$ROLE\",\"gdprConsent\":true}"

# Login
TOKEN=$(curl -ksS -X POST https://localhost:5001/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

# Call an authed endpoint
curl -ksS https://localhost:5001/users/me -H "Authorization: Bearer $TOKEN"
```

For Playwright-driven UI flows, use the same register endpoint from a
`browser_evaluate` fetch, then either:

1. `browser_evaluate` to inject `localStorage`/`sessionStorage` tokens
   the web portal uses (check `web/src/stores/auth.ts` for the key
   name — usually `accessToken` and `refreshToken`), then navigate to
   the authenticated route directly, OR
2. Drive the login form — navigate to `/login`, `browser_type` the
   credentials into the email + password fields, click submit, wait
   for the post-login route. This matches the user experience more
   closely and catches auth UI regressions.

Flow #1 is faster when you're testing a non-auth screen; flow #2 is
more realistic and should be the default for any AC where login is
part of the flow.

Use distinct email addresses per run (`$(date +%s)` or a UUID) so
reruns don't collide on `409 email already exists`.

For cross-role flows (e.g. a trainer invites a client), register two
throwaway users with different roles in the same run. They'll be
isolated from real data — the backend auto-provisions empty plans and
no historical state for fresh accounts.
