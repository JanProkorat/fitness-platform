# qa-tester — Tools you're allowed to run

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

- `gh issue view`, `gh issue comment` (read-only — do not close issues,
  do not add labels).
- `git fetch`, `git checkout`, `git diff`, `git log`, `git show` (all
  read-only).
- `dotnet build`, `dotnet test`, `dotnet run` (for boot in step 3b).
- `npm ci`, `npm run build`, `npm run lint`, `npm run dev`,
  `npm test` (if it exists), `npx tsc --noEmit`, `npx expo-doctor`,
  `npx expo start --web`.
- `npm run e2e:up`, `npm run e2e:down`, `npm run e2e:health`,
  `npm run e2e:logs` and the underlying
  `docker compose -f docker-compose.test.yml ...` (preferred backend
  boot — see `dev-server-boot.md`).
- `curl -k` against the locally running servers.
- Background-process management via `Bash`'s `run_in_background`.
- `Grep` / `Glob` / `Read` across the repo — including the prototype
  HTML under `docs/prototypes/**`.
- `xcrun simctl` for everything iOS Simulator (list/boot/install/launch/
  uninstall/shutdown/screenshot/openurl/spawn log show/terminate).
- `Agent` — only for a genuinely isolated sub-probe (e.g. "parse the
  prototype HTML and list every i18n-worthy label"). Do not use it to
  parallelise the whole AC check.
