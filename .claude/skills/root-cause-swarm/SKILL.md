---
name: root-cause-swarm
description: Parallel hypothesis exploration for multi-layer bugs. Invoke for "intermittent", "works on my machine", "random", "only in prod/CI", or after one focused debug pass landed on a guess you can't prove. Produces a ranked hypothesis report, not a fix.
---

# root-cause-swarm — parallel hypothesis probes for non-obvious bugs

Use this skill when you have a reproducible bug but the cause could plausibly
live in several layers — the kind of bug where guessing wastes a turn and
"fixing" the first hypothesis often introduces a second bug.

It is the escalation target for a single-layer debug pass: a per-status debug
workflow (reproduce → isolate → fix) is the right first move. When one such
pass cannot name the layer, or the symptom spans layers, swarm instead of
guessing.

**Root-cause before fix — no speculative patches** (Working Principles §1).
This skill is the forcing function for that rule: it turns "here's my best
guess" into "here are 5–7 probes running in parallel, each producing a test or
a falsification, and the winner is X." The fix is a separate step, routed back
through `/conductor`.

## When to invoke

Any one of these is enough:

- You have a reproducer but the stack trace alone doesn't point at one layer
  ("the response is wrong", "the lock is held by nobody but acquire fails",
  "editable in one env and not the other").
- One focused debug pass already ran and landed on a guess you cannot prove.
- The bug is intermittent, environment-dependent, or "only in prod / only in
  CI" — failure modes that invite confirmation bias.
- The symptom crosses a boundary — one layer sets a value, another reads it, a
  third persists it, a fourth caches it — so the responsible layer isn't
  self-evident.
- You are about to propose a fix without a falsifiable diagnosis sentence.
  Stop and run this skill instead.

## When NOT to invoke

- First look at a fresh, well-scoped bug — run the pack's single-layer debug
  skill first. Swarming every bug is expensive and noisy.
- The stack trace already names the file and line — just fix it.
- The fix is a build/compiler error — the toolchain already named the layer.
- A migration-history problem — **stop** and go to the pack's migration skill.

## What this skill does NOT do

- Does not pick the fix — it picks the *diagnosis*. The fix is a separate step
  once the winning hypothesis is confirmed, routed to `developer` via
  `/conductor`.
- Does not replace reading the code — each probe still reads the relevant
  files; it just prevents you from reading them through a single-hypothesis lens.
- Does not guarantee a winner on the first swarm. If every probe falsifies its
  own hypothesis, the output is still a doc — "none of A–E is the cause; next
  swarm should target F/G/H."

## Step 0 — Frame the bug precisely

Before fanning out, collect (or ask the user for) the four facts every probe
will share. One sentence each, max.

1. **Symptom** — the observable behaviour, as a user or a log sees it.
2. **Expected behaviour** — what should happen instead.
3. **Reproducer** — exact steps, ideally a scoped test target the relevant
   stack's `<stack>-verify` skill can run. If none, say so — the swarm's
   first job is to produce one.
4. **Known constraints** — what has *already* been ruled out.

Write these down. They become the header of every probe prompt in Step 2.

## Step 1 — Brainstorm the hypothesis buckets

Pick **5–7** from the stack-neutral catalogue below. Each bucket is a family of
failure surface that exists in almost any layered service; pick the ones that
could plausibly explain *this specific symptom* and ignore the rest. **Packs
may add stack-specific buckets** (a framework's own footguns, a runtime's
lifetime model) — consult the pack's debug skill for its additions before
finalising your list.

| # | Bucket | What it covers | First files to probe |
|---|--------|----------------|----------------------|
| 1 | **Contract / serialization skew** | field-casing or naming-policy mismatch across a boundary; nullable-vs-required on a request/response shape; a custom type-converter not applied; array-vs-scalar in a payload | the feature's request/response shapes, any custom (de)serialization + its converters |
| 2 | **DI / lifetime / registration** | an entry point not registered (so it 404/405s); a dependency captured by something longer-lived than its intended scope; a service resolved with the wrong lifetime | the feature's registration/wiring, the service in question and its registration |
| 3 | **Concurrency / race / ordering** | a notification/event fired before the write commits; two operations racing on the same row/resource; a missing `await`; a heartbeat/expiration window; a clock/time source not the injected one | the handler doing the work, the lock/heartbeat code, the time source |
| 4 | **Config / env / settings** | a wrong environment-specific override; a connection string; a flag enabled in one env only; a migration/setup step not applied in the failing env | settings files (read-only — never edit), env vars, deploy/pipeline variables |
| 5 | **Migration / schema / index skew** | a migration not run in the failing env; an index/constraint name left stale after a rename; column type/nullability drift vs. the model | the migrations dir, `git log` on the model + its config |
| 6 | **Auth / identity / permissions** | a required claim/token absent so an identity step is skipped, cascading into every owner/permission check; a wrong permission constant or role seed; an auth exception surfacing as a silent 401/403 | the identity/auth middleware, the entry point's permission config, the role/permission seed |
| 7 | **Test-isolation / environment** | a shared-state reset missing so a test depends on a prior test; a time/random source not pinned; a required background service down for integration tests; a placeholder seed value used where a real one is required | the test base / shared fixtures, the failing test's seed/setup |

Write the chosen buckets into a short plan — one line per bucket saying what
you're probing and why it's plausible *for this symptom*. Don't dispatch yet.

## Step 2 — Fan out parallel probes

Dispatch **one `Agent` per bucket** in a **single message** so they run in
parallel. Each probe is a **read-only, general-purpose investigator** — use a
generic read-only `Agent` call, one per bucket. Do **not** route probes through
the `researcher` agent (that one is `/conductor`-scoped and must write a
schema-validated handoff — the wrong shape for a throwaway falsification probe).

### Model selection per phase

- **Falsification probes (Step 2)** → `model: "haiku"` on the `Agent` call.
  Probes are short-lived, single-bucket, fan-out friendly; Haiku is the right
  cost tier for parallel falsification.
- **Synthesis (Step 3)** → run on the orchestrator's current model. Synthesis
  weighs 5–7 probe outputs and picks the winner — needs reasoning, not throughput.

If a Haiku probe returns unusable output (cites <3 file paths, no concrete code
snippet, or "could not find" without trying an alternative query), re-dispatch
that one probe with `model: "sonnet"` before falling back to "could not falsify".

### Probe prompt template

Every probe uses the same structure. Fill in the `{{placeholders}}` and send it
as the `prompt` of the `Agent` tool. Keep probes **read-only** unless the probe
is producing a failing test — **never** let a probe land a fix.

```
You are running as probe {{N}} of a root-cause-swarm for this bug.
Do not propose or write a fix. Your only job is to PROVE or FALSIFY one
specific hypothesis.

# Bug frame
- Symptom: {{from Step 0}}
- Expected: {{from Step 0}}
- Reproducer: {{from Step 0}}
- Already ruled out: {{from Step 0}}

# Your hypothesis ({{bucket name}})
{{one-sentence statement specific to THIS bug — not "it could be a race" but
 "the notification is awaited before the write commits, so the client is told
 to refetch before the new value is committed and visible".}}

# What would prove this hypothesis TRUE
{{one falsifiable observation — a log line, a failing test, a query log, a
 value at a breakpoint. Be concrete.}}

# What would prove this hypothesis FALSE
{{the opposite — the evidence that makes this bucket go away.}}

# Files you are allowed to read (expand only if needed)
{{initial reading list from the bucket table}}

# How to report back
Return a single block in this exact shape — nothing else:

VERDICT: {CONFIRMED | LIKELY | UNLIKELY | FALSIFIED | INCONCLUSIVE}
CONFIDENCE: {1-5}
EVIDENCE:
- bullet: {file:line or command output proving the verdict}
- bullet: {...}
REPRO OR FALSIFIER:
{if CONFIRMED/LIKELY: a minimal failing test (a scoped test target the pack can
 run) or a reproducing command
 if FALSIFIED: the test/command that passes, proving this cannot be the cause
 if INCONCLUSIVE: the missing evidence and why you couldn't get it}
NOTES: {at most 2 sentences — caveats, side observations, dead ends.}

Hard rules:
- Read-only. Do not edit production code.
- If you write a test, scope it to this hypothesis — not a full integration suite.
- Do not expand to other hypotheses. If you see evidence for another bucket,
  note it under NOTES and stop.
```

### Dispatch checklist

- [ ] Exactly one bucket per Agent call.
- [ ] All Agent calls sent in a single message (parallel).
- [ ] Bug frame (Symptom / Expected / Reproducer / Already ruled out) identical
      across every probe — synthesis depends on this.

## Step 3 — Synthesize the winner

When all probes return, build a short ranking table. Do not skip this — writing
it down is how you catch probes that agreed for different reasons.

```
| Bucket | Verdict | Confidence | Evidence summary |
|--------|---------|-----------:|------------------|
| 1 Contract skew   | FALSIFIED | 5 | response shape round-trips; casing matches policy |
| 3 Race / ordering | CONFIRMED | 4 | notify awaited before commit; client refetches pre-commit |
| 5 Migration skew  | UNLIKELY  | 3 | migration present in failing env |
```

Rules for picking the winner:

1. Prefer a **CONFIRMED with a reproducing test** over any number of LIKELY
   hypotheses. A falsifiable proof beats accumulated suspicion.
2. Two CONFIRMED probes is a red flag — usually one is a downstream symptom of
   the other. Check the test each produced; the causally upstream one wins.
3. All FALSIFIED / all INCONCLUSIVE = wrong buckets. Record which you ran, pick
   a new 5–7 from the remaining catalogue (or expand it, incl. pack-specific
   buckets), swarm again. Don't fall back to guessing.
4. CONFIRMED with confidence ≤ 2 = treat as LIKELY and demand a stronger
   reproducer before fixing.

## Step 4 — Write the diagnosis note

Save the synthesis to `docs/root-cause-swarms/<YYYY-MM-DD>-<short-kebab>.md`
(create the folder on first use). This is the skill's compounding value: the
record of which buckets actually hit which surfaces in this codebase. Future
swarms read these before picking buckets.

Template:

```markdown
# Root-cause swarm — <Symptom, one phrase>

**Date:** <YYYY-MM-DD>
**Bug frame:** <one paragraph: symptom, expected, repro, already ruled out>

## Buckets probed
| # | Bucket | Verdict | Confidence |
|---|--------|---------|-----------:|
| ... |

## Winning hypothesis
**Bucket:** <name>
**Diagnosis in one sentence:** <the cause, stated causally — "X happens because
Y, introduced when Z">
**Reproducing evidence:** <failing test target, log line, query output>

## Why the other buckets were falsified
- <Bucket>: <1-2 sentences>

## Recommended fix scope
<Which file(s); whether a migration / config change / seed fix is also needed.
Do NOT write the fix here — that's the next turn, routed to developer via
/conductor.>

## Lessons for future swarms
<1-3 sentences. What did this swarm learn about this codebase that the bucket
catalogue (or a pack-specific bucket) should eventually absorb?>
```

## Step 5 — Handback

1. Share the diagnosis note path with the user (plain repo-relative path).
2. State the winning hypothesis and its evidence in chat — one paragraph, not
   the full doc.
3. Propose the fix scope and **ask for confirmation** before routing to a fix.
   The user may want to fix it themselves now that the diagnosis is clear — the
   swarm's value is already delivered.
4. If the winner is CONFIRMED with a failing test, that test is the handoff
   artifact — the fix (via `developer` under `/conductor`) must keep it as the
   regression test. Name its path in the handback.

## Related skills to chain

Chain to the pack's own debug/review/migration skills — the common layer does
not hardcode their names; look them up in the pack (`common/PACK-CONTRACT.md`):

- **Single-layer debug skill** — if Step 0's "frame the bug" stalls (you can't
  even state the symptom precisely or produce a reproducer), run a structured
  single-layer debug pass first, then come back to swarm. That skill is also
  where a *confirmed* single-layer bug goes to be fixed.
- **Migration skill** — if the winning bucket is migration/schema/index skew,
  the fix is a corrective migration; never modify an already-applied one.
- **TDD skill** — if the winning bucket is concurrency/ordering, decide whether
  the repro test is enough or a broader test is warranted before the fix.
- **Review skill** — after the fix lands, review the final diff to confirm it
  addresses the confirmed hypothesis and didn't silently widen scope. If the
  winning bucket was auth/identity, this is also where the security angle gets a
  second look — tenancy/permission bugs tend to cluster.

## Checklist before handing back

- [ ] Bug frame written down (4 one-liners) before any probe was sent.
- [ ] 5–7 buckets chosen with a one-line plausibility note each.
- [ ] All probes dispatched in a single parallel message.
- [ ] Each probe returned the fixed VERDICT / CONFIDENCE / EVIDENCE /
      REPRO-OR-FALSIFIER / NOTES shape.
- [ ] Synthesis table exists, with at most one CONFIRMED winner.
- [ ] Diagnosis note saved under `docs/root-cause-swarms/`.
- [ ] Winning hypothesis stated as a single causal sentence.
- [ ] No fix has been written — only diagnosis.
