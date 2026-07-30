---
name: expo-screen
description: Scaffold a new Expo Router screen — theme-token styling via a theme hook, TanStack Query (or equivalent) data-fetching, an i18n mechanism, no `any`, `_layout.tsx` for sub-folders. Invoke for "new screen", "new tab", "new flow" in a React Native / Expo app.
argument-hint: "<ScreenName> <route-group>"
---

# expo-screen — scaffold an Expo Router screen

Use when adding a screen to an Expo Router app's route tree (commonly
`app/` at the package root). This skill codifies the idioms most Expo/RN
apps converge on (a design-token theme hook, a server-state query cache,
an i18n mechanism) without assuming any one project's exact folder names or
entity types — read the repo's own `CLAUDE.md` first for the concrete
layout, theme hook name, and state libraries in use.

## Read-ONE-exemplar

When choosing an exemplar to model from, read **exactly ONE existing
screen** with a similar shape (tab / detail / list / form / nested flow).
Most Expo Router apps' screen idiom is consistent enough that one is
sufficient. Fall back to a second exemplar ONLY if the first is incomplete
(e.g. doesn't cover the `_layout.tsx` pattern you need). **Never read more
than two.** If you genuinely need broader research, dispatch an Explore
sub-agent with `model: "haiku"` instead of reading many files inline —
inline reads pollute your context.

## Decide first

1. **Where does it live?** — the Expo Router group determines auth and
   navigation context. A typical split is an unauthenticated group (login,
   registration, onboarding) and one or more authenticated groups (a tab
   navigator plus nested stacks for sub-flows) — confirm the repo's actual
   group names in its route tree rather than assuming any specific ones.
2. **File name** — lowercase, matches the route segment (`index.tsx`,
   `[id].tsx`, `history.tsx`). Dynamic segments use `[param]`.
3. **Sub-screen folder?** — if the new screen opens *additional* screens
   stacked on top of a tab (e.g. detail views pushed from a list), the
   folder needs a `_layout.tsx` with a `Stack` — without it, back
   navigation breaks. (See `rules/navigation.md#sub-screen-folders-need-a-layout`.)
4. **Server state vs. app state** — server data belongs in the query cache
   (TanStack Query or equivalent); transient app state (open sheets,
   filters) in whatever lightweight store the repo uses (Zustand, Jotai,
   Redux, React Context) or local `useState`. Persisted app state goes
   through whatever persistence layer the repo already uses (e.g. a
   Zustand persist middleware backed by MMKV/AsyncStorage) — see
   `rules/data-fetching.md`.
5. **i18n namespace** — decide the key prefix for new copy before writing
   it. This pack does not name which locales the repo supports — read the
   repo's own i18n config (see `rules/i18n.md#i18n-is-a-mechanism-not-a-fixed-list`).

## File to create

`<app-root>/<group>/<name>.tsx` (path per the repo's own route tree — read
`CLAUDE.md` for where the Expo Router root actually lives). Skeleton, using
a generic `Item` entity and a generic `useTheme()` hook — substitute the
repo's real domain type, theme hook, and API module:

```tsx
import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next'; // or your repo's i18n hook
import { useQuery } from '@tanstack/react-query'; // or your repo's query-cache lib
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme'; // match the repo's actual theme hook
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { itemsApi } from '@/api/items';

export default function ItemDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id = '' } = useLocalSearchParams<{ id: string }>();

  const itemQuery = useQuery({
    queryKey: ['items', id],
    queryFn: () => itemsApi.getById(id),
    enabled: Boolean(id),
  });

  const styles = makeStyles(theme);

  if (itemQuery.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <View style={styles.center}>
        <AppText style={styles.errorText}>{t('common.error')}</AppText>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: itemQuery.data.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppText style={styles.heading}>
          {t('itemDetail.title', { name: itemQuery.data.name })}
        </AppText>
        {/* ...body... */}
        <PrimaryButton label={t('common.save')} onPress={() => {}} />
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

Match exact token names to whatever the repo's theme hook actually exports —
the names above (`theme.colors.*`, `theme.spacing.*`, `theme.typography.*`)
are representative, not prescriptive. Open a neighbouring screen and copy
its style shape.

## Sub-screen folders — `_layout.tsx` is required

If the new screen introduces a **folder** with more than one route inside it
(e.g. a `list/` folder with `index.tsx`, `[id].tsx`, `archived.tsx`), the
folder needs a layout file for the stack:

```tsx
// <app-root>/(app)/list/_layout.tsx
import { Stack } from 'expo-router';

export default function ListLayout() {
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

Without it, back navigation from `[id]` to `index` does not work — the
screen renders but the hardware back button / swipe-back gesture breaks.
See `rules/navigation.md`.

## Non-negotiables

1. **Tokens only.** No hex colors. No hard-coded spacing / radii / font
   sizes. Always via the repo's theme hook (commonly `useTheme()`) —
   `theme.colors.*`, `theme.spacing.*`, `theme.typography.*`, `theme.radius.*`
   (exact names per the repo). See `rules/code-style.md#design-tokens-over-hardcoded-values`.
2. **No `any`.** Use types from the repo's generated API client (if any) or
   its domain modules. If a shape is missing, wrap it in a typed module
   under the repo's `api/` folder — do NOT hand-edit a generated client if
   one exists. See `rules/code-style.md#no-any-in-typescript`.
3. **State split.** A lightweight app-state store (Zustand or equivalent)
   for app state; the query cache for server data. Never store server data
   in the app-state store. Never put transient UI state (sheet open/closed)
   in the store if local `useState` would do. See `rules/data-fetching.md`.
4. **Realtime via push, not polling.** If the repo has a realtime channel
   (WebSocket, a managed push-messaging service, Server-Sent Events, or
   similar), subscribe and invalidate queries on the relevant event; don't
   add `refetchInterval`
   polling as a substitute. See `rules/data-fetching.md#invalidate-dont-poll`.
5. **i18n everywhere.** Every user-visible string via the repo's i18n hook.
   Add keys to every locale the repo supports. Unknown translations → copy
   the source-locale string and flag it. See `rules/i18n.md`.
6. **`StyleSheet.create`** for layout; inline only for tiny runtime-driven
   tweaks. Builds the style object once per render tree, not on every
   render.
7. **Components have named + default export** (match the repo's existing
   casing convention, commonly PascalCase).

## Verify

Run the pack's own `expo-build` skill (`npx tsc --noEmit`) — never invoke
`tsc` ad hoc; see `common/PACK-CONTRACT.md`. Beyond the automated check:

1. Exercise the flow in a dev client or simulator/emulator, confirm back
   navigation if the screen sits in a nested stack, confirm switching
   locale updates all new copy.
2. Grep for hex literals in the new file — there should be none:
   `grep -E "#[0-9a-fA-F]{3,8}" <path-to-new-file>`.

## Accessibility considerations

Touch targets should meet the platform minimum (commonly ≥44×44pt on iOS,
≥48×48dp on Android). Check color contrast for both light and dark theme
variants if the repo's theme supports both. Add accessibility labels for
any icon-only or gesture-only controls (`accessibilityLabel` /
`accessibilityRole`). Required whenever the scaffold introduces new
interactive controls; optional for a pure read-only screen.

## Checklist

- [ ] File in the correct Expo Router group per the repo's route tree
- [ ] Default export, screen function named `…Screen`
- [ ] Sub-screen folders have `_layout.tsx` with a `Stack`
- [ ] All styling via the theme hook's tokens — no hex, no hard-coded spacing
- [ ] Server data via the query cache; no server data in the app-state store
- [ ] Realtime (if applicable) via push + `invalidateQueries`, no polling
- [ ] All copy via the i18n hook, keys present in every supported locale
- [ ] No `any`, no `@ts-ignore`/`@ts-expect-error` without a justifying comment
- [ ] Generated API client (if any) NOT hand-edited
- [ ] `npx tsc --noEmit` clean (`expo-build`)
