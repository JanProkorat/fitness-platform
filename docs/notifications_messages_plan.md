# Implementation Plan — Notifications & Messages

Reference design: `docs/mobile_prototype.html`
Screens: `ph-messages`, `ph-chat`, notification sheet on `ph-today`
Read `CLAUDE.md` before starting.

---

## Module 1 — Notifications

### 1.1 Toast

Imperative singleton. Renders once in `app/(client)/_layout.tsx`, controlled
via a ref-based emitter so any screen can trigger it without prop drilling.

```typescript
// lib/toast.ts
type ToastEmitter = { show: (message: string, duration?: number) => void }
export const Toast: ToastEmitter = { show: () => {} }  // replaced on mount
```

```typescript
// components/ui/Toast.tsx — mount in root layout
export function ToastProvider() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const translateY = useRef(new Animated.Value(20)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Toast.show = (msg, duration = 2500) => {
      setMessage(msg)
      setVisible(true)
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start()
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 20, duration: 180, useNativeDriver: true }),
        ]).start(() => setVisible(false))
      }, duration)
    }
  }, [])

  if (!visible) return null
  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  )
}
```

Styles: dark semi-transparent pill (`rgba(50,50,50,0.92)` + `BlurView`),
`border-radius: 99`, positioned `bottom: 96` (above tab bar), centered
horizontally, `pointerEvents: 'none'`.

---

### 1.2 BellButton component

```typescript
// components/ui/BellButton.tsx
interface BellButtonProps {
  count: number
  onPress: () => void
}
```

36×36 rounded square, `Colors.fill` background, bell SVG icon.
Badge: red pill top-right (`Colors.red` bg, white text, 2px white border),
min-width 16, height 16. Hidden when `count === 0`.

---

### 1.3 NotificationSheet component

Bottom sheet triggered by `BellButton` on the Today screen header.

```typescript
// components/notifications/NotificationSheet.tsx
interface NotificationSheetProps {
  visible: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkAllRead: () => void
}
```

**Layout:**
- Dimmed overlay (`rgba(0,0,0,0.4)`) — tap to close
- Sheet slides up from bottom via `Animated.timing` on `visible` change
- Border-radius `20px` top corners, `Colors.bg2` background
- Drag handle: 36×4 centered pill, `Colors.sep`
- Header row: "Notifications" title (title2) + "Mark all as read" link (blue)
- Scrollable `FlatList` of notification rows
- Max height: 82% of screen

**NotificationRow:**

```typescript
interface Notification {
  id: string
  type: 'invitation' | 'questionnaire' | 'new_plan' | 'message' | 'training_done' | 'alarm'
  title: string
  body: string
  timestamp: string      // ISO string
  read: boolean
  actionLabel?: string   // primary action text
  actionPayload?: Record<string, string>  // e.g. { planId, threadId }
}
```

Row layout: 44×44 icon square (border-radius 14) + body column + unread dot.

Unread rows: gold dot on the far left, `rgba(201,168,76,0.04)` background tint.

Icon background colors per type:
```typescript
const NOTIF_ICON_BG: Record<Notification['type'], string> = {
  invitation:     'rgba(201,168,76,0.12)',
  questionnaire:  'rgba(201,168,76,0.12)',
  new_plan:       'rgba(11,110,153,0.10)',
  message:        'rgba(0,122,255,0.10)',
  training_done:  'rgba(52,199,89,0.10)',
  alarm:          'rgba(255,59,48,0.10)',
}
```

Rows that have `actionLabel` show inline pill buttons below the body text:
- Primary: gold background, white text
- Secondary (optional "Later"): `Colors.fill`, `Colors.label2`

Action handlers route based on `type`:

| type | primary action |
|---|---|
| `invitation` | `router.push('/(client)')` — invite card visible on Today |
| `questionnaire` | `router.push('/(client)/questionnaire')` |
| `new_plan` | `router.push('/(client)/plans/' + payload.planId)` |
| `message` | `router.push('/(client)/messages/' + payload.threadId)` |
| `training_done` | sheet closes, no navigation |
| `alarm` | sheet closes, no navigation |

After action: mark notification as read via API, close sheet.

**API:**
```
GET  /api/client/notifications?limit=20&cursor=
POST /api/client/notifications/read-all
POST /api/client/notifications/{id}/read
```

Use TanStack Query. Refetch on sheet open. Optimistic update for read state.

---

### 1.4 Wiring into Today screen

In `app/(client)/index.tsx`, replace the plain page title with a header row:

```tsx
<View style={styles.header}>
  <View>
    <Text style={[Type.caption1, { color: colors.label2 }]}>{formattedDate}</Text>
    <Text style={Type.largeTitle}>Good morning,{'\n'}{firstName} 👋</Text>
  </View>
  <BellButton
    count={unreadCount}
    onPress={() => setSheetOpen(true)}
    style={{ marginTop: 16 }}
  />
</View>

<NotificationSheet
  visible={sheetOpen}
  onClose={() => setSheetOpen(false)}
  notifications={notifications}
  onMarkAllRead={markAllRead}
/>
```

`unreadCount` comes from `useNotifications()` hook (TanStack Query,
`refetchInterval: 30_000`).

---

### 1.5 Inline invite card

Shown on Today when `authStore.pendingInvite !== null`, between the header
and the has/no-trainer content.

```typescript
// components/notifications/InviteCard.tsx
interface InviteCardProps {
  invite: TrainerInvite     // { id, trainerId, trainerName, trainerRole, trainerCity }
  onAccept: () => void
  onDecline: () => void
}
```

Card structure (matches prototype `invite-card`):
- Gold border (`rgba(201,168,76,0.25)`), `Colors.bg2` background,
  `border-radius: 16`, subtle gold shadow
- Top: `Avatar` + trainer name + role · city
- Body: invitation description text (from `invite.message`)
- Footer: "Accept invitation" (gold) + "Decline" (fill) — equal flex buttons

Accept: `POST /api/client/invites/{id}/accept` → clear `pendingInvite`,
set `hasTrainer = true`, `Toast.show('Invitation accepted ✓')`.

Decline: `POST /api/client/invites/{id}/decline` → clear `pendingInvite`.

Both actions animate the card out: `opacity 0` + `maxHeight 0` over 350ms
using `Animated.parallel`, then `pendingInvite = null`.

**API:**
```
GET  /api/client/invites/pending
POST /api/client/invites/{id}/accept
POST /api/client/invites/{id}/decline
```

Poll `pending` every 30s while `!hasTrainer` (`refetchInterval: 30_000`).

---

### 1.6 Push notifications

Setup (call once after auth confirmed, in `app/(client)/_layout.tsx`):

```typescript
async function registerPushToken() {
  if (!Device.isDevice) return
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return
  const token = (await Notifications.getExpoPushTokenAsync()).data
  await api.post('/api/client/push-token', { token, platform: Platform.OS })
}
```

Foreground handler — show Toast instead of system banner:

```typescript
Notifications.addNotificationReceivedListener(notification => {
  const { title } = notification.request.content
  Toast.show(title ?? 'New notification')
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
})
```

Background/tap handler — deep link on notification tap:

```typescript
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data as NotificationPayload
  switch (data.type) {
    case 'invitation':    router.push('/(client)')                          ; break
    case 'new_plan':      router.push(`/(client)/plans/${data.planId}`)    ; break
    case 'message':       router.push(`/(client)/messages/${data.threadId}`); break
    case 'questionnaire': router.push('/(client)/questionnaire')           ; break
  }
})
```

**Required packages:**
```bash
npx expo install expo-notifications expo-device
```

---

## Module 2 — Messages

### 2.1 Data types

```typescript
// types/messages.ts

interface Conversation {
  id: string
  participant: {
    id: string
    name: string
    initials: string
    avatarColor: string
    avatarBg: string
    role: 'trainer' | 'coach'
    online: boolean
  }
  lastMessage: {
    text: string
    timestamp: string
    isOwn: boolean
  }
  unreadCount: number
}

type MessageType = 'text' | 'plan_attachment'

interface Message {
  id: string
  threadId: string
  senderId: string
  type: MessageType
  text?: string
  attachment?: PlanAttachment
  timestamp: string
  read: boolean
}

interface PlanAttachment {
  planId: string
  planType: 'training' | 'nutrition'
  planName: string
  meta: string          // e.g. "4× weekly · Week 4/12"
  gradientStart: string
  gradientEnd: string
}
```

---

### 2.2 ConversationList screen (`messages.tsx`)

**Header:** Large title "Messages" (largeTitle) + compose icon button (top right).

**Search bar:** `Colors.fill` background, magnifier icon, placeholder "Search".
Filters the local list client-side — no separate search API call needed.

**`ConversationRow` component:**

```typescript
// components/messages/ConversationRow.tsx
interface ConversationRowProps {
  conversation: Conversation
  onPress: () => void
}
```

Row layout (matches prototype `conv-row`):
- `Avatar` 50×50, border-radius 17 — with optional green online dot (16×16,
  bottom-right, white border)
- Body column: name + role badge pill, message preview
- Right column: timestamp + unread badge

Role badge: small pill, gold bg/text for "Trainer", green bg/text for "Coach".

Unread preview: `fontWeight: '600'`, `Colors.label`.
Read preview: `fontWeight: '400'`, `Colors.label2`.

Unread badge: gold pill, min-width 20, height 20, white text, font-size 12.

Separator: `Separator` component between rows.

Sort order: unread first, then by `lastMessage.timestamp` descending.

**API:**
```
GET /api/client/conversations
```

TanStack Query, `staleTime: 10_000`, `refetchInterval: 15_000`.

---

### 2.3 Chat screen (`messages/[threadId].tsx`)

This screen has three fixed zones and one scrollable zone — use absolute
positioning inside a full-screen container (same pattern as the prototype's
`chat-header` + `chat-scroll` + `chat-input-bar`).

```
┌──────────────────────────────┐  ← status bar (59px)
│  FIXED HEADER                │  ← measured height, drives scroll top offset
├──────────────────────────────┤
│                              │
│  SCROLLABLE MESSAGE LIST     │  ← position:absolute, top=headerH, bottom=inputH
│                              │
├──────────────────────────────┤
│  INPUT BAR                   │  ← fixed height + safe area
└──────────────────────────────┘
```

Measure the header height with `onLayout` and set it as the scroll area's
`top` offset. This avoids the sticky/overlap bugs.

**ChatHeader component:**

```typescript
// components/messages/ChatHeader.tsx
interface ChatHeaderProps {
  participant: Conversation['participant']
  onBack: () => void
  onInfoPress: () => void
}
```

Blurred background (`BlurView`, intensity 80), `border-bottom: 0.5px Colors.sep2`.

Layout: back chevron + "Messages" label | centered avatar + name + online status
| right action buttons (phone icon, info icon).

Online status: green dot + "Online" text, or grey "Last seen {time}".

**MessageBubble component:**

```typescript
// components/messages/MessageBubble.tsx
interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar: boolean    // false for consecutive messages from same sender
}
```

Own (right): gold background (`Colors.gold`), white text,
`borderBottomRightRadius: 5`, all other corners 18.

Theirs (left): `Colors.bg2` background, `Colors.label` text,
`borderBottomLeftRadius: 5`, all other corners 18, subtle shadow.
Show small `Avatar` (26×26, border-radius 9) to the left — only on last
message in a consecutive group, otherwise render a 26px spacer.

Timestamp below each bubble group: 10px, `Colors.label3`.
Own messages show double-checkmark read receipt icon beside timestamp.

**PlanAttachmentCard component:**

```typescript
// components/messages/PlanAttachmentCard.tsx
interface PlanAttachmentCardProps {
  attachment: PlanAttachment
  onPress: () => void
}
```

Rounded card (border-radius 14), max-width 220.
Hero zone (height 70): `LinearGradient`, plan type label in small caps,
plan name large bold white.
Footer zone: `Colors.bg2`, meta text on left, chevron on right.
Tap → `router.push('/(client)/plans/' + attachment.planId)`.

**ContextBanner component** (shown when trainer has active plan or pending check-in):

```typescript
// components/messages/ContextBanner.tsx
interface ContextBannerProps {
  icon: string
  title: string
  sub: string
  actionLabel: string
  onAction: () => void
}
```

Gold left border (3px), gold tint background `rgba(201,168,76,0.08)`,
gold border `rgba(201,168,76,0.2)`, border-radius 12.

Shown at the top of the scroll area, above the first message.
Fetch from `/api/client/conversations/{id}/context` — returns `null` when
there is nothing to show; hide banner in that case.

**TypingIndicator component:**

Three dots that bounce in sequence. Stagger with `Animated.loop`:

```typescript
// Stagger delays: 0ms, 200ms, 400ms
// Each dot: translateY 0 → -5 → 0, duration 600ms per cycle
```

Same bubble shape as received messages (left-aligned, `Colors.bg2`),
fixed width 56px. Show when `isTyping === true` from polling or WebSocket.

**DateSeparator:** centered row, text "Monday, March 30", 12px, `Colors.label3`,
`fontWeight: '500'`. Rendered between message groups from different calendar days.

**ChatInputBar component:**

```typescript
// components/messages/ChatInputBar.tsx
interface ChatInputBarProps {
  onSend: (text: string) => void
  onAttachPress: () => void
}
```

Blurred background, `border-top: 0.5px Colors.sep2`, safe area padding bottom.

Three zones in a row:
- Attachment button: 32×32 circle, `Colors.fill`, plus icon
- Text input: flex-1, `Colors.bg2` background, `border-radius: 20`, 0.5px
  `Colors.sep` border, font-size 16. Grows vertically up to 5 lines.
- Send button: 32×32 gold circle, arrow icon. Disabled (reduced opacity)
  when input is empty.

On send: clear input, call `onSend`, optimistically append message to list,
scroll to bottom.

**Message list:**

`FlatList` inverted (`inverted={true}`) — simplest way to keep scroll pinned
to bottom and paginate upward.

```typescript
// Pagination
GET /api/client/conversations/{id}/messages?cursor={oldestMessageId}&limit=30
```

Load more when user scrolls to top (`onEndReached` on inverted list =
reaching the old messages). Show `ActivityIndicator` while loading.

Optimistic send: append a local message with `status: 'sending'`, replace
with server response on success, mark `status: 'error'` on failure (show
retry option).

Real-time: poll every 5 seconds (`refetchInterval: 5_000`) for new messages.
Leave this comment in the code:
```typescript
// TODO: replace polling with WebSocket (socket.io or native WS)
// POST /api/client/conversations/{id}/typing  (debounced, on input change)
```

**API:**
```
GET  /api/client/conversations/{id}/messages?cursor=&limit=30
POST /api/client/conversations/{id}/messages     { text: string }
GET  /api/client/conversations/{id}/context
GET  /api/client/conversations/{id}/typing-status
POST /api/client/conversations/{id}/typing       (debounced 1s)
```

---

### 2.4 Unread badge on tab bar

```typescript
// hooks/useUnreadCount.ts
export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 15_000,
    select: (data) => data.reduce((sum, c) => sum + c.unreadCount, 0),
  })
  return data ?? 0
}
```

Pass to the Messages tab in `(client)/_layout.tsx`:
```tsx
<Tabs.Screen
  name="messages"
  options={{
    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
    tabBarBadgeStyle: { backgroundColor: Colors.gold },
  }}
/>
```

---

## Required packages

```bash
npx expo install expo-notifications expo-device
npx expo install @gorhom/bottom-sheet   # for NotificationSheet
npx expo install expo-linear-gradient   # for PlanAttachmentCard hero
npx expo install expo-blur              # for ChatHeader + ChatInputBar
```

---

## Component file map

```
components/
  ui/
    BellButton.tsx
    Toast.tsx               ← ToastProvider + Toast singleton
  notifications/
    NotificationSheet.tsx
    NotificationRow.tsx
    InviteCard.tsx
  messages/
    ConversationRow.tsx
    ChatHeader.tsx
    MessageBubble.tsx
    PlanAttachmentCard.tsx
    ContextBanner.tsx
    TypingIndicator.tsx
    DateSeparator.tsx
    ChatInputBar.tsx

hooks/
  useNotifications.ts       ← fetches + unread count
  useUnreadCount.ts         ← derived from conversations query
  useMessages.ts            ← paginated message list + send mutation
  useTypingStatus.ts        ← polling for remote typing state

lib/
  toast.ts                  ← Toast emitter singleton
```

---

## Implementation order

Build in this sequence — each item unblocks the next:

1. `Toast` (needed by everything else for feedback)
2. `BellButton` + `NotificationRow` + `NotificationSheet` (wired into Today)
3. `InviteCard` + invite API hooks (wired into Today)
4. Push notification registration + foreground/background handlers
5. `ConversationRow` + `messages.tsx` list screen
6. `ChatHeader` + `ChatInputBar` + `MessageBubble` + chat screen layout
7. `PlanAttachmentCard` + `ContextBanner` + `TypingIndicator` + `DateSeparator`
8. Pagination, optimistic send, unread badge on tab bar
