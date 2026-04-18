# Routing: changed file → Notion page

Used by `update.md`. For every path in the diff, apply the first rule
that matches. Paths not matched by any rule contribute to the Changelog
entry but do **not** update a dedicated Notion page.

Resolve paths relative to the repo root. The examples below show
package-relative paths after the prefix.

## Backend

| Path pattern | Target Notion page | Section to patch |
|---|---|---|
| `backend/**/Features/<Folder>/**` (new folder) | New **Feature page** under `Backend / Features` | entire body (create) |
| `backend/**/Features/<Folder>/**/*Endpoint.cs` | **Feature page** `<Folder>` | `Endpoints` table |
| `backend/**/Features/<Folder>/**/*Request.cs` / `*Response.cs` / `*Validator.cs` | **Feature page** `<Folder>` | `Endpoints` table (refine relevant row) |
| `backend/**/Domain/Entities/<Name>.cs` (new) | New **Entity page** under `Backend / Entities` | create |
| `backend/**/Domain/Entities/<Name>.cs` (edit) | **Entity page** `<Name>` | `Fields` / `Relationships` |
| `backend/**/Domain/Documents/<Name>.cs` (new) | New **Document page** under `Backend / Documents` | create |
| `backend/**/Domain/Documents/<Name>.cs` (edit) | **Document page** `<Name>` | `Fields` |
| `backend/**/Domain/Enums/**` | **Domain glossary** | relevant term |
| `backend/**/Domain/Constants/AppRoles.cs` / `AppClaims.cs` | **Architecture / Auth & roles** | body |
| `backend/**/Domain/Constants/ErrorCodes.cs` | no page update; Changelog only |
| `backend/**/Infrastructure/SignalR/**` | **Architecture / SignalR realtime** | body |
| `backend/**/Infrastructure/Services/<Name>.cs` | **Backend / Services** | service list |
| `backend/**/Data/**` (migrations, contexts) | **Architecture / Storage** | body |
| `backend/**/Tests/**` | no page update; Changelog only |
| `backend/**/Program.cs` / `appsettings*.json` | **Architecture / System overview** | body |

## Web

| Path pattern | Target Notion page | Section to patch |
|---|---|---|
| `web/src/pages/<Name>.tsx` (new) | New **Web page** under `Web / Pages` | create |
| `web/src/pages/<Name>.tsx` (edit) | **Web page** `<Name>` | relevant section |
| `web/src/components/<category>/**` | **Web / Components** | `<category>` list |
| `web/src/api/<module>.ts` | **Web page(s)** consuming it | `Data` section(s) |
| `web/src/api/generated.ts` | no page update (auto-generated); Changelog only as "Regenerated" |
| `web/src/hooks/**` / `web/src/stores/**` | **Web hub** | conventions list |
| `web/src/i18n/**` | **Architecture / i18n & design tokens** | body |
| `web/vite.config.ts` / `web/tailwind.config.ts` | **Architecture / System overview** | body |

## Mobile

| Path pattern | Target Notion page | Section to patch |
|---|---|---|
| `mobile/app/<path>.tsx` (new) | New **Mobile screen** under `Mobile / Screens` | create |
| `mobile/app/<path>.tsx` (edit) | **Mobile screen** at `<path>` | relevant section |
| `mobile/app/<folder>/_layout.tsx` | **Mobile / Screens** | layout list |
| `mobile/src/components/<category>/**` | **Mobile / Components** | `<category>` list |
| `mobile/src/api/<module>.ts` | **Mobile screen(s)** consuming it | `Data` section(s) |
| `mobile/src/api/generated.ts` | no page update; Changelog only as "Regenerated" |
| `mobile/src/hooks/**` / `mobile/src/stores/**` | **Mobile hub** | conventions list |
| `mobile/src/constants/**` | **Architecture / i18n & design tokens** | body |
| `mobile/src/i18n/**` | **Architecture / i18n & design tokens** | body |

## Prototypes

| Path pattern | Target Notion page | Section to patch |
|---|---|---|
| `docs/prototypes/mobile/**` | **Prototypes / Mobile prototype** | `Scenes` table |
| `docs/prototypes/trainer/**` | **Prototypes / Trainer prototype** | `Scenes` table |
| `docs/prototypes/notion/**` | **Prototypes / Notion portal** | `Scenes` table |
| `docs/prototypes/build.mjs` | all 3 Prototype pages | `Build` section |
| `docs/mobile_prototype.html` / `docs/trainer_prototype.html` / `docs/notion_portal.html` | matching Prototype page | no patch — artefact is generated; Changelog bullet `"Regenerated: …"` |

## Repo root

| Path pattern | Target Notion page | Section to patch |
|---|---|---|
| `CLAUDE.md` | **Architecture & Conventions** | intro |
| `.claude/CLAUDE.md` | **Root page** | "Orchestration" callout |
| `.claude/skills/<skill>/**` | no page update (skill is meta); Changelog bullet under `Repo root` |
| `.claude/agents/**` / `.claude/hooks/**` | no page update; Changelog only |
| `docs/PROGRESS.md` | **must not be written** (frozen). If a caller tries, abort and warn. |
| Anything else | Changelog only |

## Decision flow (pseudo)

```
for path in changed_paths:
    rule = first matching row in the tables above
    if rule.target_page:
        pages_to_patch.add((rule.target_page, rule.section))
    # Always include in Changelog regardless
    changelog_bullets.add(path)

# New-page detection: if any path under Features/<X> AND no existing
# Feature page 'X' in Notion → pages_to_create.add(('Feature page', 'X'))
# Same for Entities, Documents, Web pages, Mobile screens.
```

## Ambiguity handling

- A path matches multiple rules → take the **most specific** rule
  (longer pattern wins; hardcoded filename beats glob).
- A task touches 20+ files across many pages → the update is still one
  Changelog entry, but may update many pages. That's expected — don't
  collapse pages arbitrarily.
- A new page's natural parent doesn't exist yet (e.g. a brand-new
  `Services` folder) → create the hub first, then the leaf.
- A path looks unrelated to docs (e.g. a CI workflow change) → Changelog
  only, under `Repo root`. Don't invent a page for it.
