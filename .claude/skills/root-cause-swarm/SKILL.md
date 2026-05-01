---
name: root-cause-swarm
description: Parallel hypothesis exploration for multi-layer bugs (Working Principles §1). Invoke for "intermittent", "works on my machine", "random", or after one focused investigation failed. Produces ranked hypothesis report.
---

# root-cause-swarm — parallel hypothesis probes for non-obvious bugs

Use this skill when you have a reproducible bug but the cause could
plausibly live in several layers of the stack — the kind of bug where
guessing wastes a turn and "fixing" the first hypothesis often introduces a
second bug. It is the **sibling of `ui-tradeoff`**: where ui-tradeoff stops
blind UI iteration, this skill stops blind logic-bug iteration.

Working Principles §1 bans speculative patches. This skill is the forcing
function: it turns "here's my best guess" into "here are 5–7 probes running
in parallel, each producing a test or a falsification, and the winner is X."

## When to invoke

Any one of these is enough:

- You have a reproducer but the stack-trace alone doesn't point at one
  layer. "The response is wrong" / "the SignalR event doesn't arrive" /
  "the list is empty after login on the second device."
- One focused investigation has already run and landed on a guess that
  you can't prove.
- The bug is described as intermittent, environment-dependent, or "only
  in prod" — failure modes that invite confirmation bias.
- The symptom crosses a package boundary (backend broadcasts, mobile
  ignores) so the responsible layer isn't self-evident.
- You, as Claude, are about to propose a fix without a falsifiable
  diagnosis sentence. Stop and run this skill instead.

## When NOT to invoke

- First look at a fresh, well-scoped bug — investigate normally first.
  Swarming every bug is expensive and noisy.
- The stack-trace already names the file and line — just fix it.
- UI timing / layout / animation bugs — those go to `ui-tradeoff`.
- A bug whose fix is a typecheck or build error — the compiler already
  pointed at the layer.

## What this skill does NOT do

- Does not pick the fix — it picks the *diagnosis*. The fix is a separate
  step once the winning hypothesis is confirmed.
- Does not replace reading the code — each parallel probe still reads
  the relevant files. It just prevents you from reading them through a
  single hypothesis lens.
- Does not guarantee a winner on the first swarm. If every probe
  falsifies its own hypothesis, the output is still a doc — "none of
  A/B/C/D/E is the cause; next swarm should target F/G/H."

## Step 0 — Frame the bug precisely

Before fanning out, collect (or ask the user for) the four facts that
every probe will share. One sentence each, max.

1. **Symptom** — the observable behaviour, as a user or a log sees it.
   Example: "Trainer opens `/trainer/clients/<id>` after a workout is
   submitted; the 'Recent logs' card is empty until a hard reload."
2. **Expected behaviour** — what should happen. Example: "Recent logs
   list updates within ~1s of the client pressing 'Finish workout'."
3. **Reproducer** — exact steps. If none, say so — the swarm's first job
   is to produce one.
4. **Known constraints** — what has *already* been ruled out. Example:
   "The backend endpoint does call `NotifyAsync` — we see the log.
   `KNOWN_EVENTS` contains `workoutlogsubmitted` on mobile. The trainer
   is authenticated and in the right SignalR group."

Write these down. They become the header of every Agent prompt you
dispatch in Step 2.

## Step 1 — Brainstorm the hypothesis buckets

Pick **5–7** from the catalogue below (or add your own). The catalogue
is tuned for this codebase — every bucket has hit real bugs in real
sessions. Pick the ones that could plausibly explain *this specific
symptom*; ignore the ones that obviously cannot.

| # | Bucket | What it covers | First files to probe |
|---|--------|----------------|----------------------|
| 1 | **Contract / serialization skew** | DTO field added without regen; camelCase vs PascalCase; nullable vs required; `generated.ts` stale; JsonIgnore on a property the client expects | `web/src/api/generated.ts`, `mobile/src/api/generated.ts`, backend `*Request` / `*Response` records |
| 2 | **DI lifetime / scope** | Singleton holding scoped state; `DbContext` captured in a singleton; `HttpClient` scope misuse; Mongo client reuse | `Program.cs` service registrations, the service in question |
| 3 | **Concurrency / race / ordering** | Event fired before commit; SignalR connect race vs initial fetch; TanStack Query refetch racing invalidation; `await` missing | endpoint `HandleAsync`, `NotificationHub`, the relevant `useSignalR` block |
| 4 | **Config / env / appsettings** | Missing env var; wrong `appsettings.Development.json` override; feature flag off in one env; CORS/proxy mismatch | `appsettings*.json`, `.env*`, Vite proxy config, Expo `app.config.ts` |
| 5 | **State / cache skew** | Stale TanStack Query cache; MMKV persisted state out of date; Zustand rehydration lag; refresh-token rotation loop | the relevant Zustand store, `queryClient` config, `stores/auth.ts` |
| 6 | **Version skew / deploy ordering** | Backend shipped without client regen; migration not run; Expo OTA lag; SignalR protocol version | `git log` on the touched files, recent `dotnet ef migrations` output, `/web/package.json` vs `generated.ts` |
| 7 | **Auth / permissions / tenancy** | Wrong role claim; IDOR on the endpoint; SignalR group membership drift; cross-trainer leak | endpoint auth attributes, `NotificationHub` group mapping, `AppRoles` / `AppClaims` |
| 8 | **Data shape / schema / index** | Mongo `Version` optimistic-concurrency bump skipped; EF relationship not loaded; denormalized document out of sync with source | the Mongo document class, the owning repository |
| 9 | **External integration drift** | OpenFoodFacts schema change; MinIO bucket policy; push provider token rotation; email provider rate limit | the service wrapper in `Infrastructure/Services/`, provider logs |
| 10 | **Client / platform specific** | iOS vs Android; Safari vs Chromium; simulator vs device; keyboard / offline / background-fetch quirks | the component file, Expo / RN version pins |

Write the chosen buckets into a short plan — 1 line per bucket saying
what you're probing and why it's plausible *for this symptom*. Don't
dispatch yet.

## Step 2 — Fan out parallel probes

Dispatch **one `Agent` per bucket** in a **single message** so they run
in parallel. Pick the right sub-agent for each probe based on where
the probe will read:

- Probe that reads `/backend/**` → `backend-dotnet`
- Probe that reads `/web/**` → `web-react`
- Probe that reads `/mobile/**` → `mobile-expo`
- Probe that spans packages or reads docs/infra only → `general-purpose`

### Model selection per phase

- **Falsification probes (Step 2)** → `model: "haiku"` on the `Agent`
  call. Probes are short-lived, single-bucket, fan-out friendly.
  Haiku is the right cost-tier for parallel falsification.
- **Synthesis (Step 3)** → run on the orchestrator's current model
  (typically Sonnet or Opus). Synthesis weighs 5–7 probe outputs and
  picks the winning hypothesis — needs reasoning, not throughput.

If a Haiku probe returns unusable output (cites <3 file paths, contains
no concrete code snippet, or "could not find" without trying an
alternative query), re-dispatch the same probe with `model: "sonnet"`
before falling back to "could not falsify".

Never let one sub-agent cross package boundaries — the "one sub-agent =
one package" rule from `.claude/CLAUDE.md` still applies. A probe that
needs cross-package evidence either splits into two probes or is
handled by `general-purpose`.

### Probe prompt template

Every probe uses the same structure. Fill in the {{placeholders}} and
send it as the `prompt` of the `Agent` tool. Keep probes read-only
unless the probe is producing a failing test — **never** let a probe
land a fix; the skill's job is diagnosis, not repair.

```
You are running as probe {{N}} of a root-cause-swarm for this bug.
Do not propose or write a fix. Your only job is to PROVE or
FALSIFY one specific hypothesis.

# Bug frame
- Symptom: {{from Step 0}}
- Expected: {{from Step 0}}
- Reproducer: {{from Step 0}}
- Already ruled out: {{from Step 0}}

# Your hypothesis ({{bucket name}})
{{one-sentence statement of the hypothesis you are probing, specific
 to this bug — not just "it could be serialization" but "the
 `workoutlogsubmitted` payload is serialized with PascalCase
 `ClientId` but the mobile handler reads lowercase `clientId`".}}

# What would prove this hypothesis true
{{one falsifiable observation — a log line, a unit test that fails,
 a curl output, a breakpoint value. Be concrete.}}

# What would prove this hypothesis false
{{the opposite — the evidence that makes this bucket go away.}}

# Files you are allowed to read (expand only if needed)
{{initial reading list from the bucket table, scoped to the package}}

# How to report back
Return a single block in this exact shape — nothing else:

VERDICT: {one of CONFIRMED | LIKELY | UNLIKELY | FALSIFIED | INCONCLUSIVE}
CONFIDENCE: {1-5}
EVIDENCE:
- bullet: {file:line or command output proving the verdict}
- bullet: {...}
REPRO OR FALSIFIER:
```
{if CONFIRMED/LIKELY: a minimal failing test or reproducing command
 if FALSIFIED: the test or command that passes, proving the
 hypothesis cannot be the cause
 if INCONCLUSIVE: the missing evidence that would move this off
 the fence, and why you couldn't get it}
```
NOTES: {at most 2 sentences — caveats, side observations, dead ends.}

Hard rules:
- Read-only. Do not edit production code.
- If you write a test, scope it to the failing hypothesis — not a
  full integration test.
- Do not expand your scope to other hypotheses. If you see evidence
  for another bucket, note it under NOTES and stop.
- Stay inside your package. Report cross-package findings to NOTES.
```

### Dispatch checklist

- [ ] Exactly one bucket per Agent call.
- [ ] All Agent calls sent in a single message (parallel).
- [ ] Correct sub-agent type for each probe (backend / web / mobile /
      general-purpose).
- [ ] Bug frame (Symptom / Expected / Reproducer / Already ruled out)
      identical across every probe — synthesis depends on this.

## Step 3 — Synthesize the winner

When all probes return, build a short ranking table. Do not skip this —
writing it down is how you catch probes that agreed with each other
for different reasons.

```
| Bucket | Verdict | Confidence | Evidence summary |
|--------|---------|-----------:|------------------|
| 1 Contract skew | FALSIFIED | 5 | generated.ts matches DTO; payload round-trips |
| 3 Race / ordering | CONFIRMED | 4 | Notify fires inside tx; client receives before commit visible |
| 5 Cache skew | UNLIKELY | 3 | queryClient invalidation key is correct |
| ...
```

Rules for picking the winner:

1. Prefer a **CONFIRMED with a reproducing test** over any number of
   LIKELY hypotheses. A falsifiable proof beats accumulated suspicion.
2. Two CONFIRMED probes is a red flag — usually one of them is a
   downstream symptom of the other. Check the test each produced; the
   causally upstream one is the winner.
3. All FALSIFIED / all INCONCLUSIVE = you picked the wrong buckets.
   Record which ones you ran, pick a new 5–7 from the remaining
   catalogue (or expand it), and swarm again. Don't fall back to
   guessing.
4. CONFIRMED with confidence ≤ 2 = treat as LIKELY and demand a
   stronger reproducer before fixing.

## Step 4 — Write the diagnosis note

Save the synthesis to
`docs/root-cause-swarms/<YYYY-MM-DD>-<short-kebab>.md`. (Create the
folder on first use.) This is the skill's compounding value: the
catalogue of which buckets actually hit which surfaces in this
codebase. Future swarms read these before picking buckets.

Template:

```markdown
# Root-cause swarm — <Symptom, one phrase>

**Date:** <YYYY-MM-DD>
**Invoker:** root-cause-swarm skill (Working Principles §1)
**Bug frame:** <one paragraph: symptom, expected, repro, already
ruled out>

## Buckets probed
| # | Bucket | Sub-agent | Verdict | Confidence |
|---|--------|-----------|---------|-----------:|
| ... |

## Winning hypothesis
**Bucket:** <name>
**Diagnosis in one sentence:** <the cause, stated causally — "X
happens because Y, which was introduced when Z">
**Reproducing evidence:** <failing test path, log line, curl output>

## Why the other buckets were falsified
- <Bucket>: <1-2 sentences>
- ...

## Recommended fix scope
<Which package(s), which file(s), whether a regen / migration / deploy
order change is also needed. Do NOT write the fix here — that's the
next turn, routed to the owning dev sub-agent.>

## Lessons for future swarms
<1-3 sentences. What did this swarm learn about this codebase that
the bucket catalogue should eventually absorb? E.g. "Mongo Version
field is the #1 cause of 'list empty after write' symptoms — promote
bucket 8 up the priority order for that symptom family.">
```

## Step 5 — Handback

1. Share the diagnosis note path with the user (as a `computer://`
   link in Cowork).
2. State the winning hypothesis and the evidence in the chat — one
   paragraph, not the full doc.
3. Propose the fix scope and **ask for confirmation** before routing
   to the dev sub-agent. The user may want to fix it themselves now
   that the diagnosis is clear; the swarm's value is already delivered.
4. If the winner is CONFIRMED with a failing test, that test is the
   handoff artifact — the dev sub-agent that takes the fix must keep
   it as the regression test. Name its path in the handback.

## Related skills to chain

- **`engineering:debug`** — if Step 0's "frame the bug" stalls (you
  can't even state the symptom precisely), run a structured debug
  session first to get a reproducer, then come back to swarm.
- **`engineering:code-review`** — after the fix lands, a review over
  the final diff catches whether the fix actually addresses the
  confirmed hypothesis or silently widened scope.
- **`engineering:testing-strategy`** — if the winning bucket is
  concurrency / ordering, add this before the fix to decide whether
  the repro test is enough or a broader property test is warranted.
- **`gc-sec-review`** — if the winning bucket is auth / tenancy,
  chain a security review once the fix is in; tenancy bugs tend to
  cluster.
- **`ui-tradeoff`** — if mid-swarm the evidence points at a UI
  rendering / timing problem rather than a logic bug (bucket 10
  confirmed with "iOS only animation glitch"), abandon this swarm
  and switch to the ui-tradeoff skill. Different tool for a different
  failure mode.

## Checklist before handing back

- [ ] Bug frame written down (4 one-liners) before any probe was sent
- [ ] 5–7 buckets chosen with a one-line plausibility note each
- [ ] All probes dispatched in a single parallel message
- [ ] Each probe returned the fixed VERDICT / CONFIDENCE / EVIDENCE /
      REPRO-OR-FALSIFIER / NOTES shape
- [ ] Synthesis table exists, with at most one CONFIRMED winner
- [ ] Diagnosis note saved under `docs/root-cause-swarms/`
- [ ] Winning hypothesis stated as a single causal sentence
- [ ] No fix has been written — only diagnosis
