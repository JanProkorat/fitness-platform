---
description: State and data-fetching conventions for React Native / Expo apps — query cache vs. app-state store, realtime invalidation
---

# Rules: State & Data Fetching

Assumes TanStack Query (React Query) v5+ as the reference implementation
for server state since it's the most common choice in this stack; the same
conventions apply if the repo uses SWR or another query-cache library —
substitute that library's equivalent hooks/APIs. Assumes Zustand as the
reference implementation for app state, for the same reason — substitute
Jotai/Redux/Context if that's what the repo uses.

## Query-cache over fetch-in-`useEffect`

All server reads go through `useQuery`, all server writes through
`useMutation`. A raw `fetch`/axios call inside a `useEffect` — with manual
loading/error `useState` — is an anti-pattern this rule bans: it reimplements
caching, deduplication, and race-condition handling that the query cache
already gives you for free, and it's a BLOCKING finding on review.

```tsx
// NO
const [data, setData] = useState<Item | null>(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetchItem(itemId).then((i) => { setData(i); setLoading(false); });
}, [itemId]);

// YES
const { data, isPending } = useQuery({
  queryKey: ['items', itemId],
  queryFn: () => itemsApi.getById(itemId),
});
```

## Server state vs. app state — do not mix

- **Server state** (anything that ultimately comes from the API) lives in
  the query cache. Never duplicate server data into the app-state store
  "for convenience" — that's the classic source of stale-UI bugs where the
  two copies drift.
- **App/UI state** (auth session, active tab, sheet-open flags, offline
  banner visibility) lives in the app-state store (Zustand or equivalent).
  Don't introduce a second state-management library alongside an existing
  one without discussing it first.
- **Local component state** (`useState`) for anything that doesn't need to
  survive a re-render of the parent or be shared across components.
- **Persistence** (surviving an app restart) goes through whatever the
  store's own persistence middleware uses (commonly backed by MMKV or
  AsyncStorage) — match the existing setup rather than adding a second
  persistence mechanism.

## Query keys

- Keys are arrays, most-general-first: `['items']`, `['items', itemId]`,
  `['items', itemId, 'details']`. Keep the shape consistent across a domain
  so a broad invalidation (`['items']`) correctly cascades to every
  narrower key.
- Never build a key from an unstable reference (an object, a fresh array
  literal with unstable identity) — use primitives (ids, filter strings) so
  the cache can actually match repeated calls.

## Invalidate on mutation or realtime push — don't poll

After a `useMutation` succeeds, `invalidateQueries` for every query key the
mutation affects. If the repo has a realtime channel (WebSocket, a managed
push-messaging service, Server-Sent Events, or similar), invalidate the same
keys on the relevant
inbound event instead of (or in addition to) the mutation's own
`onSuccess`. Prefer either of these over polling (`refetchInterval`) as the
default way to keep data fresh. Polling is acceptable only for a specific,
discussed case (e.g. a live status with no push channel); it is not the
default freshness strategy.

```tsx
const updateMutation = useMutation({
  mutationFn: (values: FormValues) => itemsApi.update(itemId, values),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items', itemId] });
  },
});
```

## Loading and error states

Every `useQuery` consumer handles `isPending` and `isError` explicitly
before rendering the success path — don't let a component render on `data`
that might still be `undefined`. Use the query cache's own `isPending`/
`isError` flags rather than a parallel manually-tracked loading `useState`.

## Mutations don't optimistically mutate the cache without a rollback path

If a mutation uses `onMutate` to optimistically update the cache, it MUST
also implement `onError` to roll back to the previous value (captured via
`onMutate`'s returned context) and `onSettled` to invalidate afterwards. An
optimistic update with no rollback is a BLOCKING finding — it leaves the UI
showing state the server rejected.
