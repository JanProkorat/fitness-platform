---
description: React Native / Expo code style rules — strict typing, design tokens, component conventions
---

# React Native / Expo Code Style Rules

## No `any` in typescript

The package is strict-mode TypeScript. `any`, `as any`, and
`@ts-ignore`/`@ts-expect-error` are BLOCKING findings unless accompanied by
a comment explaining the unavoidable interop reason and, ideally, a
follow-up issue. Fix the type instead:

- Prefer the types exported by the generated API client (if the repo has
  one — see `skills/regen-api` in the sibling web pack, or the repo's own
  equivalent) over hand-rolled interfaces for anything that crosses the
  network boundary.
- For a genuinely unknown shape, narrow with a type guard or `unknown` +
  runtime validation (e.g. a Zod schema) rather than reaching for `any`.

```ts
// NO
function handle(payload: any) { ... }

// YES
function handle(payload: unknown) {
  const parsed = payloadSchema.parse(payload);
  ...
}
```

## Design tokens over hardcoded values

Colors, spacing, font sizes, and radii MUST come from the project's design-
token system, surfaced through a theme hook (commonly `useTheme()`) rather
than inlined. Read the repo's own `CLAUDE.md`/theme module for the exact
hook name and the shape of `theme.colors`/`theme.spacing`/etc. — this rule
does not prescribe one theme-module layout.

No hex/rgb literals, no inline `style={{ ... }}` objects carrying hard-coded
values, no magic pixel numbers scattered through components. If a value is
missing from the token set, add it to the theme rather than inlining —
inlining a brand color or spacing value, even a *correct* one, is a BLOCKING
finding, not just a style nit, because it desyncs from the token the next
theme change won't reach.

```tsx
// NO — hardcoded hex + magic spacing
<View style={{ backgroundColor: '#1a73e8', marginTop: 24 }}>...</View>

// YES — token-driven (exact hook/property names are project-specific)
const styles = makeStyles(theme);
<View style={styles.banner}>...</View>
// where makeStyles derives from theme.colors.accent / theme.spacing.lg
```

## `StyleSheet.create` for layout styles

Build style objects via `StyleSheet.create` once per component module (or
via a `makeStyles(theme)` factory called once per render, not per element).
Inline `style={{ ... }}` is acceptable only for small tweaks that genuinely
depend on a runtime value (an animated value, a measured layout) that can't
be expressed statically — not as a substitute for the theme lookup above.

## No hardcoded API base URLs

API base URLs come from env/config (e.g. Expo's `EXPO_PUBLIC_*` env vars, or
`app.config.*`'s `extra` field) — never a literal `https://...` string in
application code. Match whatever convention the repo has already
standardized on.

## Generated files are write-locked (if the repo has one)

If the repo generates a typed API client from an OpenAPI/Swagger source
(commonly `src/api/generated.ts`), it must not be hand-edited — a PreToolUse
hook may reject Edit/Write on matching paths locally; a reviewer flags any
diff hunk against it as BLOCKING regardless. To extend generated behaviour,
add wrappers in a sibling module (e.g. `src/api/<domain>.ts`). To change
shapes, regenerate against the running backend — never patch the generated
output directly, even "just this once."

## Component conventions

- One component (plus its co-located sub-components/hooks) per file; match
  the repo's existing casing convention for filenames (commonly PascalCase
  for component files).
- Named export **and/or** default export — match whichever the surrounding
  directory already uses; don't introduce a second export style in a
  directory that's consistently one or the other.
- Presentational vs. data-fetching concerns: prefer pulling `useQuery`/
  `useMutation` calls into the screen component or a custom hook, keeping
  deeply-nested presentational components free of direct data-fetching so
  they stay easy to reuse and test.
- Path alias: use whatever import alias the repo has configured (commonly
  `@/…`), never relative traversal past one folder (`../../../components`).
