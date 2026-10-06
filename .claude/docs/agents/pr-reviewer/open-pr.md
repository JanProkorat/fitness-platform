# pr-reviewer — Step 2: create or update the PR

> On-demand section of `.claude/agents/pr-reviewer.md`, moved verbatim (#1214).

Check whether a PR already exists for the branch:

```bash
gh pr list --head <branch> --state open --json number,url,title,body,labels
```

**If none:** open it against the **base the orchestrator passed**.

```bash
gh pr create \
  --base <base>          # develop / main
  --head <branch> \
  --title "<N>: <short thing, a few words, English>" \
  --body "$(cat <<'EOF'
## Summary
<2–4 bullet points from qa-tester's verdict and the issue body>

## Related issue
Fixes #<N>

## Scope
<BE | Web | Mobile | cross-cut>

## QA verdict (from qa-tester)
<one-line paste of OVERALL line plus any PARTIAL caveats>

## Test plan
- [ ] <the AC bullets from the issue, copied verbatim>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

For the **epic-level PR** (orchestrator passes `base: develop` and a
`head: feature/<epic-N>-<short>` branch), the body's "Summary" lists
the tasks that landed on the epic branch — one `Fixes #<task>.` line
per task plus one for the epic, so GitHub closes them all on merge (the
tasks were left open on purpose). The "Test plan" section pastes the
union of every task's AC bullets, deduplicated where they overlap.

Then copy the issue's kind, package and priority labels onto the PR:

```bash
gh pr edit <pr-number> --add-label "<Epic|Task|Bug|Chore>" --add-label "<BE|Web|Mobile>" --add-label "<High|Medium|Low>"
```

**If a PR already exists:** update its body with the latest QA verdict
summary and re-apply labels if they drifted. Do not rewrite unrelated
sections a human edited (summary, design notes) — edit by section, not
whole-file replace.
