# Inbox + chat — design inventory, issue #1095 (page 5 of epic #1052)

Four renders beside this file — **the contract**, in reading order:

1. `inbox-empty-target.png` — list populated, no thread selected.
2. `inbox-filter-dropdown-target.png` — the filter dropdown open.
3. `inbox-thread-target.png` — a thread open, client panel hidden.
4. `inbox-thread-client-panel-target.png` — the same thread with the
   "Show client" panel open on the right.

## Provenance, and what it limits

**User-supplied screenshots taken on 2026-09-22, not pulled Figma nodes.**
The Figma connector is at its plan's monthly limit. Structure, order, copy and
layout are reliable; pixel sizes are read off the image and approximate.
Where the repo already has a token or component for the same purpose, prefer
it over a number estimated here. The shell (dark sidebar) is #1073's and is
not part of this page; the wireframe shows the full seven-section sidebar,
ours shows the two v1 sections by design.

## Three decisions the user made before this was filed

1. **Images are real attachments** (MinIO, signed URLs) — own sub-issue.
2. **Video is never stored.** All video is shared as YouTube links; the
   thread renders a preview card from the link. See the
   `project-chat-media-policy` note (issue #1096).
3. **Generic files are out of v1** — the paperclip renders disabled.

## Layout — three panes

| Pane | Width (approx., at ~1450px) | Content |
|---|---|---|
| Conversation list | ~235px | title, Active dropdown, search, filter, rows |
| Thread | flexible | header, messages, composer |
| Client panel | ~300px, **hidden by default** | the #1094 Overview cards |

Panes are separated by a hairline (`border-border`). The thread pane has a
thin outline in screens 1–2 because it is the selected Figma frame — not a
design element.

### Conversation list

- Header row: **Inbox** (`text-title`-ish bold, ~18px) left; right a small
  muted dropdown **Active ▾** — Active / Archived, maps to the
  `archived` query flag.
- Search input, full width, search icon left, placeholder `Search chats...`.
  Filters the loaded list in the browser by participant name.
- Filter trigger beneath: muted text `All (2)` with a chevron right-aligned.
  Opens the dropdown in screen 2: a card with nine rows, the selected one
  highlighted (pale blue fill, check mark right): `All (2)`,
  `Failed payments (0)`, `Unread messages (2)`, `No messages (0)`,
  `New check-ins (1)`, `Blocked automations (0)`, `Missing check-ins (2)`,
  `Ending soon (0)`, `Tasks overdue (1)`. Counts in parentheses. Order is the
  wireframe's — keep it. Failed payments, Blocked automations and Tasks
  overdue have **no backend** and render disabled with the coming-soon tooltip.
- Rows: ~44px avatar circle (dark navy fill, white initials), **name** bold
  ~13px, time right-aligned muted ~11px (`08:01`, `14:29`, `Yesterday`),
  preview line muted ~12px beneath the name, single line truncated. Unread:
  a small blue dot right of the preview (`John Doe` row). Selected row has a
  pale grey fill and rounded corners (screen 3).

### Thread — empty state (screens 1–2)

Centred: a dashed-outline square (~48px) holding a bold **C** glyph — the
wireframe's placeholder for the product logo; use the `GF` mark the sidebar
already renders, not a literal C. Beneath: `Select a chat to begin messaging`
(~15px, medium) and a muted sub-line `Your client inbox, workout questions,
and onboarding metrics live here.`

### Thread — open (screens 3–4)

- Header: avatar + **name** left; right: an outlined button
  **Show client** (person icon) that toggles to **Hide client** when the
  panel is open; a gear icon (no backend — disabled, coming-soon); an
  external-link icon → `/clients/:clientId`.
- Body: a centred muted date separator (`Jan 28, 8:01 AM`); the client's
  messages left-aligned with a small avatar, pale grey bubble, rounded
  corners; the coach's messages right-aligned, **dark navy bubble, white
  text**, small `C` avatar to the right (use the coach's initials).
- Screen 3 also shows two **workout-session cards** and a **video
  attachment** inside the thread. Session cards have no message-level
  backend and are **out of scope**. The video becomes a **YouTube preview
  card**: thumbnail ~250px wide, rounded, with the link's caption line
  beneath in the wireframe's `title • Video • 4:12 mins` shape — only the
  thumbnail and the caller-typed text are available; do not invent duration.
- Composer, pinned bottom: rounded input `Type your message here...`, a
  paperclip icon (disabled — files out of v1) and an image icon (disabled
  until the image-attachments sub-issue lands) at the left inside the field,
  a dark circular **send** button with an arrow at the right.

### Client panel (screen 4)

Right pane, scrollable: **name** + status pill (`ACTIVE`, pale green fill
in the mock — reuse `ClientStatusBadge`), a gear icon top-right (disabled),
the meta line `25 years old • Male • 180 cm` and the `Weight Loss` goal
chip, then a **2×2 stat grid** (Average rating / Current weight / Client
since / Payments — the same four cards as the Overview tab, in a two-column
grid instead of four), then **Check-in trend** and **Messages trend** full
width. Everything here is the #1094 component set, laid out narrower — no
second implementation. The mock's red rating card and `$149/mo` payment are
TBD in ours, same as the Overview tab.

## Colours and type — all existing tokens

Nothing here needs a new token. Own bubbles use the sidebar's dark surface
(`--gf-sidebar-bg`) with white text; other bubbles `bg-muted`. Unread and
selected-filter blue is the existing accent/info token — confirm at design
review rather than adding a chat palette. Avatars reuse `ClientAvatar`.

## Data

Existing: `GET /conversations?archived=`, `GET /conversations/{id}/messages`
(cursor, newest-first), `POST /conversations`, `POST …/messages`,
`POST …/read`, `PATCH …/archive|unarchive`; hub events `newmessage`,
`typing`, `userPresence`, `conversationunarchived`.

New in this page's issue: `filter` + per-filter counts on
`GET /conversations`, sharing the clients-list classification via a
`Domain/Services/` helper. Spec in the issue body.

## Copy

New namespace `inbox.*` in cs, en, de. Reuse `shell.comingSoon` for every
disabled control. Date/time formatting through the existing helpers.

See [[docs/design/1094/client-overview-inventory.md]] for the cards the
client panel reuses, and [[docs/design/1073/shell-inventory.md]] for the
shell.
