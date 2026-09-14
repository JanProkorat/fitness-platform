---
description: Expo Router navigation conventions — route groups, sub-screen layouts, dynamic segments
---

# Rules: Navigation (Expo Router)

Assumes Expo Router's file-based routing (the current standard for new
Expo apps). If the repo instead uses React Navigation configured
imperatively, adapt the same underlying principles (grouped stacks,
explicit layout ownership) to that API.

## Route groups determine context, not just folder tidiness

A route group (`(groupName)`) partitions the tree without adding a URL
segment — commonly used to separate an unauthenticated flow (login,
registration, onboarding) from one or more authenticated flows (a tab
navigator, nested detail stacks). Read the repo's actual `app/` tree before
assuming any particular group names; this pack does not prescribe them.

## Sub-screen folders need a `_layout.tsx`

If a folder under a route group contains more than one screen that forms a
stack (e.g. a list screen plus a `[id]` detail screen pushed on top of it),
that folder needs its own `_layout.tsx` exporting a `Stack`:

```tsx
// app/(app)/list/_layout.tsx
import { Stack } from 'expo-router';

export default function ListLayout() {
  return <Stack screenOptions={{ headerShown: true, headerBackTitle: '' }} />;
}
```

Without it, the screen still renders, but back navigation (hardware back
button on Android, swipe-back gesture on iOS) silently breaks — the folder
has no stack to pop. This is a common regression: treat a missing
`_layout.tsx` on any new nested folder as a BLOCKING finding, not a nit.

## Dynamic segments

Use `[param]` for a single dynamic segment (`[id].tsx`), `[...rest]` for a
catch-all. Read params via `useLocalSearchParams<{ id: string }>()` (Expo
Router) rather than manually parsing the URL.

## Screen-level options via `<Stack.Screen options={...} />`

Set a per-screen title/header dynamically (e.g. once query data has loaded)
via `<Stack.Screen options={{ title: ... }} />` rendered inside the screen
component, rather than a static title baked into the route's static config
— this lets the header reflect loaded data (an item's name, a count) without
a second render pass.

## Never build ad hoc deep-link/navigation strings

Use `router.push`/`router.navigate` (or the repo's typed route helper, if
one exists) with the route's actual path — never string-concatenate a path
by hand in a way that bypasses the router's own typed routes feature, if the
repo has TypeScript route typing enabled (`experiments.typedRoutes`).
