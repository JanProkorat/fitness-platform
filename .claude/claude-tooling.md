# Claude Code tooling — local setup notes

This file documents non-default Claude Code tooling the project relies on
that doesn't ship in the repo. Each entry covers what the tool does, how
to install it, and exactly what to paste where.

Project-level tooling (`.claude/`, `.mcp.json`) is checked in and lives in
the repo. **User-global tooling** (`~/.claude/settings.json`,
`~/.claude/hooks/`, binaries on `$PATH`) is per-developer and the user
sets it up by hand from the snippets below.

---

## CCometixLine — terminal statusline

Renders the current git branch and real-time token-budget usage in the
terminal prompt during a Claude Code session. Aligns with the
token-frugality discipline in the global `~/.claude/CLAUDE.md` —
visibility into the 5-hour window without context-switching.

### Install

CCometixLine ships as a single binary. Install per the upstream
README and place the binary either on `$PATH` or under
`~/.claude/ccline/ccline` (the path the wire-up snippet below
expects). Verify:

```bash
~/.claude/ccline/ccline --help    # or: ccline --help if on $PATH
```

Update the `command` path in the snippet below if you placed the
binary somewhere else.

### Wire-up — `~/.claude/settings.json`

Add (or merge) the following `statusLine` block into your **user-global**
settings file. This file is **not** in the repo — it's per-developer.

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/ccline/ccline",
    "padding": 0
  }
}
```

Adjust the `command` path to wherever your binary lives. Restart Claude
Code (or run `/reload-plugins`) to pick up the change.

### Smell to fix immediately — duplicate `statusLine` keys

JSON is last-key-wins, so a duplicated `statusLine` block silently makes
the second one win and the first dead code. Most editors / linters will
flag it. If `~/.claude/settings.json` ends up with two `statusLine`
entries, delete the stale one. The `statusline-setup` agent
(`Agent: statusline-setup`) handles this cleanly on request.

### Optional: show only conversation tokens (delta wrapper)

Out of the box, ccline reads its token total by tallying everything in
the active transcript — system prompt, tool definitions, skill
catalogue, MCP schemas, agent definitions, active `CLAUDE.md` files,
auto-memory, plus your conversation. On a project with many plugins
that **structural baseline** alone fills 50–60% of the 1M Opus 4.7
context window before you've typed anything. `/clear` does not drop
the percentage meaningfully because it only wipes conversation
history, not the baseline.

If you'd rather see "tokens added since session start" — a counter
that actually drops to ~0% on a fresh session — point your statusline
at the project's wrapper script instead of `ccline` directly:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/repo/.claude/scripts/ccline-convo.sh",
    "padding": 0
  }
}
```

The script lives in this repo at
[`.claude/scripts/ccline-convo.sh`](scripts/ccline-convo.sh) and:

- Reads `session_id` and `transcript_path` from the JSON Claude Code
  pipes to the statusline command on every render.
- Sums the `usage` fields across the transcript JSONL
  (`input_tokens` + `output_tokens` + cache reads / creates).
- Persists the first-seen total per session to
  `~/.claude/.statusline-baselines/<session-id>.txt`.
- Displays `current − baseline` against the available room
  (`1M − baseline`, configurable via `CCLINE_CAP_TOKENS`).
- Keeps the existing 5h-block segment on the right (`⏳ Xh YYm · NN.N%`)
  when `ccusage` is on `$PATH`.

#### `/clear` behavior

- If your Claude Code version mints a new `session_id` on `/clear`,
  the wrapper auto-snapshots a fresh baseline.
- If `session_id` survives `/clear`, manually reset the counter:

  ```bash
  rm -rf ~/.claude/.statusline-baselines
  mkdir -p ~/.claude/.statusline-baselines
  ```

#### Caveats

- The token sum reads `usage` fields that Claude Code writes into the
  transcript JSONL. If your version uses a different shape, the count
  reads 0 and the bar shows `0% [        ] · 0 convo`. Inspect the
  transcript first:
  `head -3 "$(jq -r .transcript_path < /tmp/last-statusline-input.json)"`
  (after capturing one render).
- Baseline includes whatever was in the transcript at first render —
  installing or uninstalling plugins mid-session makes the baseline
  stale. Delete the baseline file to refresh.
- The script assumes the **1M-token Opus 4.7 cap** by default. Set
  `CCLINE_CAP_TOKENS=200000` (or whatever) for non-1M models.

### Troubleshooting

- **Statusline doesn't render.** Confirm the binary is executable:
  `chmod +x ~/.claude/ccline/ccline`. Check the `command` path resolves:
  `ls -l <path-from-settings>`.
- **Old statusline still showing.** Restart Claude Code; settings cache
  per-session.
- **Two statuslines stacking.** See the duplicate-keys note above —
  it's almost always two `statusLine` entries.
- **ccline % stays fixed and `/clear` doesn't budge it.** That's
  expected — ccline reads total context fill, not conversation delta.
  See "Optional: show only conversation tokens (delta wrapper)" above
  for the wrapper that drops to ~0% on a fresh session.

---

## Other user-global tooling (placeholder)

As more user-global tools land (e.g. `claude-security-guardrails` hooks
under `~/.claude/hooks/`), document them in this file with the same
shape: **what / install / wire-up snippet / troubleshooting**.
