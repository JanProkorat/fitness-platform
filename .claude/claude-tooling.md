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

### Troubleshooting

- **Statusline doesn't render.** Confirm the binary is executable:
  `chmod +x ~/.claude/ccline/ccline`. Check the `command` path resolves:
  `ls -l <path-from-settings>`.
- **Old statusline still showing.** Restart Claude Code; settings cache
  per-session.
- **Two statuslines stacking.** See the duplicate-keys note above —
  it's almost always two `statusLine` entries.
- **Token-budget reads wrong.** ccline pulls from Claude Code's session
  state; if `/usage` shows the right numbers but ccline doesn't, restart
  Claude Code to refresh the IPC channel.

---

## Other user-global tooling (placeholder)

As more user-global tools land (e.g. `claude-security-guardrails` hooks
under `~/.claude/hooks/`), document them in this file with the same
shape: **what / install / wire-up snippet / troubleshooting**.
