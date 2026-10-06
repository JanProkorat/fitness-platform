# qa-tester — Step 6 verdict template

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

Structure the response exactly like this so the orchestrator can parse
it reliably:

```
OVERALL: ✅ PASS   (or ⚠️ PARTIAL, or ❌ FAIL)

Issue #<N>: <title>
Scope(s): <backend | web | mobile | cross-cut>
Branch: <branch>

Dev servers:
  compose api (:5101):   started by qa-tester  |  reused  |  not needed
  dotnet run  (:5001):   started by qa-tester  |  reused  |  not needed
  web         (:5173):   started by qa-tester  |  reused  |  not needed
  expo web:              started by qa-tester  |  reused  |  not needed
  ios sim:               started by qa-tester  |  reused  |  not needed

Full-surface results (regression gate):
  backend: ✅ dotnet build PASS, dotnet test PASS (148/148)
  web:     ✅ npm run build PASS (12.3s)
  mobile:  ✅ npx tsc --noEmit PASS, npx expo-doctor PASS

Per-criterion results:
  1. <criterion text>
     Status: ✅ PASS | ❌ FAIL | ⚠️ UNVERIFIED
     Evidence: <command + output slice | Playwright action + assertion | file:line | test name>

  2. <criterion text>
     Status: ...
     Evidence: ...

Prototype fidelity:
  <per-board summary from step 5, light + dark, OR "No UI change" / "Screen not yet redesigned" / "Waived by the user">

Additional findings (not in the AC but blocking):
  - e.g. "de locale missing for 2 new keys — hard fail"
  - e.g. "web/src/api/generated.ts hand-edited — blocks PR"
  - e.g. "unrelated test FitnessPlatform.Tests/Endpoints/Messaging/ArchiveEndpointTests.Archive_WhenAlreadyArchived_Returns409 broke on this branch"
  - e.g. "Playwright console: Uncaught TypeError in /nutrition/plans/:id at PlanDetail.tsx:87"

Artifacts:
  - .qa-artifacts/<issue>/<scene>.png, etc. (if any)

Recommended next step:
  - Route fix list to <backend-dotnet | web-react | mobile-expo>:
    * <specific fix #1 — file:line or test name>
    * <specific fix #2>
  OR
  - ✅ Ready for pr-reviewer.
```
