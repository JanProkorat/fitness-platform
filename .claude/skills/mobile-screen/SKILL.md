---
name: mobile-screen
description: Scaffold a new Expo Router screen in `/mobile/app/` — useTheme() tokens, TanStack Query, Zustand, i18n cs/en/de, no `any`, `_layout.tsx` for sub-folders. Invoke for "new screen", "new tab", "new flow" in mobile.
argument-hint: "<ScreenName> <route-group>"
---

# mobile-screen — scaffold an Expo Router screen

Use when adding a screen to `/mobile/app/`. This skill codifies the idioms
that keep mobile consistent with the tokenized design system and the
Zustand/TanStack Query split.

## Read-ONE-exemplar

When choosing an exemplar to model from, read **exactly ONE existing
screen** with a similar shape (tab / detail / list / form / nested
flow). Mobile's idiom is consistent enough that one is sufficient.
Fall back to a second exemplar ONLY if the first is incomplete (e.g.
doesn't cover the haptics or `_layout.tsx` pattern you need).
**Never read more than two**. If you genuinely need broader research,
dispatch an Explore sub-agent with `model: "haiku"` instead — inline
reads pollute your context.

## Decide first

1. **Where does it live?** — the Expo Router group determines auth and tab
   context:
   - `(auth)/` — login / register / verification / onboarding questionnaire
     (unauthenticated)
   - `(client)/` — authenticated tab navigator (today, messages, discover,
     plans, profile); nested folders for sub-flows
   - `(discover)/` — trainer discovery flow
2. **File name** — lowercase, matches the route segment (`index.tsx`,
   `[id].tsx`, `history.tsx`). Dynamic segments use `[param]`.
3. **Sub-screen folder?** — if the new screen opens *additional* screens
   stacked on top of a tab (e.g. detail views from a list), the folder
   needs a `_layout.tsx` with a `Stack` — without it, back navigation
   breaks. (This has burned us before.)
4. **Server state vs. app state** — server data lives in TanStack Query;
   transient app state (open sheets, filters) in Zustand or local
   `useState`. Persisted app state (last-selected filter) in MMKV via the
   existing Zustand persist middleware.
5. **i18n namespace** — translations go in
   `mobile/src/i18n/locales/{cs,en,de}.json`. Decide the key prefix before
   writing copy.

## File to create

`mobile/app/<group>/<name>.tsx`. Skeleton:

```tsx
import { useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { AppText } from '@/components/ui/AppText';
import { GoldButton } from '@/components/ui/GoldButton';
import { clientsApi } from '@/api/clients';

export default function ClientDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id = '' } = useLocalSearchParams<{ id: string }>();

  const clientQuery = useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.getById(id),
    enabled: Boolean(id),
  });

  const styles = makeStyles(theme);

  if (clientQuery.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (clientQuery.isError || !clientQuery.data) {
    return (
      <View style={styles.center}>
        <AppText style={styles.errorText}>{t('common.error')}</AppText>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: clientQuery.data.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppText style={styles.heading}>
          {t('clientDetail.title', { name: clientQuery.data.name })}
        </AppText>
        {/* ...body... */}
        <GoldButton label={t('common.save')} onPress={() => {}} />
      </ScrollView>
    </>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    heading: {
      fontSize: theme.typography.heading.size,
      fontWeight: theme.typography.heading.weight,
      color: theme.colors.text,
    },
    errorText: {
      color: theme.colors.danger,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
  });
```

Match exact token names to whatever is exported from `src/constants/` — the
names above are representative. Open a neighbouring screen and copy the style
shape.

## Sub-screen folders — `_layout.tsx` is required

If the new screen introduces a **folder** under `(client)/` (e.g. a
`messages/` folder with `index.tsx`, `[id].tsx`, `archived.tsx`), the folder
needs a layout file for the stack:

```tsx
// mobile/app/(client)/messages/_layout.tsx
import { Stack } from 'expo-router';

export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '',
      }}
    />
  );
}
```

Without it, back navigation from `[id]` to `index` does not work — the screen
renders but the hardware back button / swipe gesture breaks.

## Non-negotiables

1. **Tokens only.** No hex colors. No hard-coded spacing / radii / font
   sizes. Always via `useTheme()` → `theme.colors.*`, `theme.spacing.*`,
   `theme.typography.*`, `theme.radius.*`. Brand accent is `#c9a84c` and it
   lives in the theme.
2. **No `any`.** Use types from `@/api/generated` or domain modules. If a
   shape is missing, wrap it in `@/api/<module>.ts` — do NOT edit
   `generated.ts` (the hook will reject it).
3. **State split.** Zustand for app state (auth, today, messages, theme,
   offline). TanStack Query for server data. Never store server data in
   Zustand. Never put transient UI state (sheet open/closed) in Zustand if
   local `useState` would do.
4. **Realtime via SignalR, not polling.** Subscribe with `onEvent` from
   `@/api/signalr` (see the `signalr-event` skill) and invalidate queries.
5. **i18n everywhere.** Every user-visible string via `useTranslation()`.
   Add keys to all three locales. Unknown translations → copy English and
   flag.
6. **`StyleSheet.create`** for layout; inline only for tiny runtime-driven
   tweaks. Builds the style object once per render tree.
7. **Components have named + default export** (PascalCase).

## Verify

1. `cd mobile && npx tsc --noEmit` passes.
2. `npx expo start --ios` — exercise the flow, confirm back navigation if
   nested, confirm switching language updates all copy.
3. Grep for hex literals in the new file — there should be none:
   `grep -E "#[0-9a-fA-F]{3,8}" mobile/app/<path>`.

## Token-compliance scan (post-scaffold)

After the screen renders, invoke the
`delightful-design-system:audit-with-delightful` skill (or the
`audit_css` MCP tool from the same plugin) to flag any hardcoded
colors, spacing, font sizes, or radii in the new file. Use the
output as a **hardcoded-value detector only** — the skill maps to
Delightful's OKLCH tokens by default, so ignore its replacement
suggestions; route real fixes back to this project's `useTheme()`
tokens (`theme.colors.*`, `theme.spacing.*`, `theme.typography.*`,
`theme.radius.*`). Brand gold `#c9a84c` must only appear via the
theme entry, never inline.

Required when the scaffold introduces any new styling. Skip when
the new screen is a pure-routing wrapper with no styling.

## Final step — i18n validation

Before reporting done, invoke the `i18n-expert` skill to audit cs / en / de
key parity for any new user-facing copy the scaffold introduced:

```
Skill: i18n-expert:i18n-expert  audit mobile/src/i18n/locales/{cs,en,de}.json for the new <prefix>.* keys (cs is the source of truth)
```

The skill flags missing keys per locale, hardcoded strings that bypassed
`useTranslation()`, pluralization gaps, and ICU-format drift. Required when
the scaffold introduces any new user-facing string — skip only when the
new screen adds zero new copy (e.g. a pure-routing wrapper).

## Related skills to chain

- **`design:design-critique`** — after the screen lands, quick pass on
  hierarchy and spacing given the 390-wide iOS constraint.
- **`design:accessibility-review`** — touch target sizes (≥ 44×44pt),
  contrast in both light and dark themes, VoiceOver labels.
- **`design:ux-copy`** — especially for empty states, permission prompts,
  error banners. Keep cs/en/de copy parity.
- **`design:design-system`** — if a token (spacing, radius, text style) is
  missing, extend `src/constants/` via this skill rather than inlining.
- **`design:design-handoff`** — when translating a scene from
  `docs/mobile_prototype.html` to real RN code, the handoff skill helps
  capture the exact token/state matrix without drift.

## Checklist

- [ ] File in the correct Expo Router group (`(auth)` / `(client)` / `(discover)`)
- [ ] Default export, screen function named `…Screen`
- [ ] Sub-screen folders have `_layout.tsx` with a `Stack`
- [ ] All styling via `useTheme()` tokens — no hex, no hard-coded spacing
- [ ] Server data via `useQuery`/`useMutation`; no data in Zustand
- [ ] Realtime via `onEvent` + `invalidateQueries`, no polling
- [ ] All copy via `t(...)`, keys in cs/en/de
- [ ] No `any`, no `@ts-ignore` without a justifying comment
- [ ] `generated.ts` NOT modified (hook enforces this)
- [ ] `npx tsc --noEmit` clean
