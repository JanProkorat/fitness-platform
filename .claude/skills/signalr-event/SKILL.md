---
name: signalr-event
description: Wire a new SignalR realtime event end-to-end across backend, web, and mobile. Invoke when a task needs "push", "realtime", "broadcast", "live update", or whenever a backend mutation should cause clients to invalidate queries without polling. Coordinates changes in all three packages — the orchestrator should run this skill and dispatch each package section to the matching sub-agent in order.
---

# signalr-event — add a realtime event end-to-end

Use this skill when a backend state change needs to propagate to connected
clients instantly. The pattern the platform already uses: the backend
broadcasts a lowercase event name via `IRealtimeNotifier`; clients listen for
it and invalidate the relevant TanStack Query keys. **No polling.**

## Orchestrator responsibility

This skill crosses all three packages. The orchestrator runs it in phases:

1. **Decide the event contract** (below) — done in the orchestrator's context.
2. Hand the **Backend** section to `backend-dotnet`. Wait.
3. `regen-api` is **not** needed unless you also changed an endpoint contract —
   the event payload is not part of the Swagger surface.
4. Hand the **Web** section to `web-react`. Wait.
5. Hand the **Mobile** section to `mobile-expo`. Wait.
6. Verify with the checklist at the bottom.

Never let one sub-agent do all three — the "one sub-agent = one package" rule
still applies. The skill is the shared specification, not a license to
cross-cut.

---

## Step 0 — Decide the event contract

Fill these in before touching any package:

1. **Event name** — all lowercase, single word or concatenated. Existing names
   to match in style: `newmessage`, `invitationreceived`, `typing`,
   `nutritionplanpublished`, `trainingplanupdated`, `conversationunarchived`.
2. **Payload shape** — a small, read-only object. Include only the ids and
   timestamps the client needs to decide what to invalidate. The client will
   re-fetch authoritative data — don't push the whole entity.
3. **Audience** — which user(s) should receive it? Use the user's id as the
   SignalR group (the hub already puts each authenticated user into a group
   named after their user id on connect — see `NotificationHub`). Broadcasts
   go via `IRealtimeNotifier.NotifyAsync(userId, eventName, payload, ct)`.
4. **Which query keys does each client need to invalidate?** List them before
   writing the handlers.

Worked example used below: a new **`workoutlogsubmitted`** event telling a
trainer that one of their clients finished a workout.

```
event name: workoutlogsubmitted
payload:    { logId: Guid, clientId: Guid, submittedAt: DateTime }
audience:   the trainer (one user id)
web keys to invalidate:    ['trainer', 'clients', clientId, 'recent-logs']
mobile keys to invalidate: (none — the client app publishes this event)
```

---

## Step 1 — Backend (`/backend`, `backend-dotnet` agent)

### 1a. Broadcast from the endpoint

Inside the slice's `HandleAsync` (after persistence succeeds), call the
notifier. `IRealtimeNotifier` is already in DI.

```csharp
await notifier.NotifyAsync(
    trainerId,
    "workoutlogsubmitted",
    new { LogId = log.ExternalId, ClientId = log.ClientId, SubmittedAt = log.UpdatedAt },
    ct);
```

Rules:
- Event name passed to `NotifyAsync` is lowercase, string-literal.
- Payload is an anonymous object — JSON serializer handles camelCasing.
- Broadcast AFTER the DB write commits, not before.
- If the broadcast fails, do NOT fail the request — the write succeeded.
  `IRealtimeNotifier` already swallows transport errors; if it doesn't,
  wrap the call in try/catch and log a warning.

### 1b. Write the test

Extend the endpoint's test file to assert the notifier was invoked.
`EndpointTestHelpers` provides a fake `IRealtimeNotifier` you can inspect.

```csharp
[Fact]
public async Task Submit_Success_BroadcastsWorkoutLogSubmitted()
{
    // arrange + act
    // assert
    fakeNotifier.Events.Should().ContainSingle(e =>
        e.EventType == "workoutlogsubmitted" &&
        e.UserId == trainerId);
}
```

Match whatever helper shape already exists in neighbouring tests
(`Endpoints/Messaging/SendMessageTests.cs` is a good reference — messaging
already has broadcasts).

### 1c. Update the known-events list

The mobile client keeps a `KNOWN_EVENTS` array (see mobile step). Add the new
event there as part of the mobile phase — not here.

---

## Step 2 — Web (`/web`, `web-react` agent)

### 2a. Find the right place to listen

`AppShell.tsx` registers a `useSignalR` handler map that lives at the app
root. Per-page listeners exist too (see `MessagesPage.tsx`). Choose based on
scope:
- **App-wide** (notifications, toasts) → `AppShell.tsx`
- **Page-scoped** (reflects data only visible on one page) → in the page's
  own `useSignalR({...})` call

### 2b. Add the handler

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { useSignalR } from '@/hooks/useSignalR';

const queryClient = useQueryClient();

useSignalR({
  workoutlogsubmitted: (payload) => {
    const p = payload as { logId: string; clientId: string };
    queryClient.invalidateQueries({
      queryKey: ['trainer', 'clients', p.clientId, 'recent-logs'],
    });
  },
  // ...other existing handlers
});
```

Rules:
- Key is lowercase — `useSignalR` lowercases anyway, but stay consistent.
- Cast `payload` inside the handler; do NOT use `any`. If the shape is shared
  with other handlers, define it in `@/types/realtime.ts`.
- Do not fetch data inside the handler — only invalidate. TanStack Query
  refetches whatever is subscribed.
- If the event affects multiple query keys, invalidate all of them.

### 2c. Smoke-test

`npx tsc --noEmit` must pass. There's no automated test suite on web; verify
manually by triggering the backend action and watching devtools network.

---

## Step 3 — Mobile (`/mobile`, `mobile-expo` agent)

### 3a. Add to the known-events list

`mobile/src/api/signalr.ts` has a `KNOWN_EVENTS` array used to pre-register
no-op handlers (suppresses SignalR warnings). Add the new event:

```ts
const KNOWN_EVENTS = [
  // ...existing
  'workoutlogsubmitted',
];
```

### 3b. Register the handler

Use the `onEvent` export. Typical places:
- App-wide: a root effect in `app/_layout.tsx` or a dedicated hook in
  `src/hooks/` (see `useSignalR.ts` for the pattern)
- Screen-scoped: in the screen's `useEffect` cleanup, calling the unsubscribe
  function returned by `onEvent`

```ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onEvent } from '@/api/signalr';

useEffect(() => {
  const unsubscribe = onEvent('workoutlogsubmitted', (payload) => {
    const p = payload as { logId: string; clientId: string };
    queryClient.invalidateQueries({
      queryKey: ['clients', p.clientId, 'recent-logs'],
    });
  });
  return unsubscribe;
}, [queryClient]);
```

Rules:
- `onEvent` already lowercases the event name — still pass it lowercase.
- Always return the unsubscribe function from the effect — missing it leaks
  handlers across screen transitions.
- No `any`. Define a payload type if the shape is non-trivial.
- No data fetching in the handler — only `invalidateQueries`.

### 3c. Smoke-test

`npx tsc --noEmit` must pass. Run on iOS simulator and confirm the Today /
Messages screen refreshes without polling.

---

## Related skills to chain

- **`engineering:code-review`** — run at the end over the full cross-package
  diff. Realtime events are a common source of subtle bugs (double-fires,
  wrong query invalidations, memory leaks via missing unsubscribes).
- **`engineering:testing-strategy`** — when the event has meaningful
  reordering / dedup concerns, invoke this before writing backend tests.
- **`gc-sec-review`** — if the event payload could leak data across tenants
  (e.g. user A seeing user B's notification), run a quick review of the
  broadcast target resolution.

## Cross-package verification checklist

- [ ] Backend broadcasts the event *after* DB write, not inside the transaction
- [ ] Event name is lowercase everywhere (backend literal, web key, mobile
      `KNOWN_EVENTS`, mobile `onEvent` call)
- [ ] Payload contains only ids/timestamps, not full entities
- [ ] Backend test asserts the notifier was invoked with the right event type
      and user id
- [ ] Web `tsc --noEmit` clean; handler casts payload without `any`
- [ ] Mobile `tsc --noEmit` clean; event added to `KNOWN_EVENTS`; unsubscribe
      returned from `useEffect`
- [ ] No polling loops introduced anywhere — only `invalidateQueries`
- [ ] Each sub-agent touched only its own package
