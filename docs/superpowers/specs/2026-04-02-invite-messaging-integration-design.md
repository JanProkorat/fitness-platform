# Invite + Messaging Integration

**Date:** 2026-04-02
**Scope:** Backend (ASP.NET Core) + Mobile (React Native/Expo)

## Problem

When a coach sends an invite with a personal message, that message only appears in the `InviteCard` on the home page. There is no chat conversation created, and no way to see the message in the messaging system. The invite and messaging features are disconnected.

## Goal

Connect the invite flow with messaging so that:
1. When a coach sends an invite with a message to an **existing user**, a conversation is created (or reused) and the message appears as a chat message.
2. When a coach sends an invite to a **new user** (no account), the coach's personal message is included in the invitation email.
3. An invite banner is shown on both the client's home page and at the top of the chat window, with working accept/decline buttons in both places.

## Design

### Backend Changes

#### 1. `CreatePendingInviteEndpoint` — Chat creation for existing users

In the existing `if (existingUser is not null)` block, after creating the notification:

- Look up the professional's `UserId` (already available as `professionalProfile.UserId`)
- Query for an existing `Conversation` where `ProfessionalUserId == professionalProfile.UserId` and `ClientUserId == existingUser.Id`
- If no conversation exists, create one
- If `req.Message` is not null/empty, create a `ChatMessage`:
  - `ConversationId` = conversation.Id
  - `SenderUserId` = professionalProfile.UserId (the coach)
  - `Text` = req.Message
  - `IsRead` = false
- Update the conversation preview fields (`LastMessageText`, `LastMessageAt`, `LastMessageSenderId`)
- Send `newMessage` SignalR event to the client with the standard payload (conversationId, messageId, senderId, senderName, text, timestamp)

#### 2. `CreatePendingInviteEndpoint` — Email message for new users

- Pass `req.Message` to `emailService.SendInvitationEmailAsync` as a new parameter
- Update `IEmailService.SendInvitationEmailAsync` signature to accept an optional `message` parameter
- Update the email service implementation to include the coach's message in the email body when provided

#### 3. New endpoint: `GET /conversations/{conversationId}/context`

Location: `Features/Messaging/GetConversationContext/`

This endpoint is already called by the mobile app but not implemented. It returns contextual banner data for a conversation.

**Logic:**
- Parse `conversationId` (PublicId) and authenticate the user
- Find the conversation, verify the user is a participant
- Determine professional and client user IDs from the conversation
- Look up the professional's `ProfessionalProfile` by `UserId`
- Query `PendingInvites` for a pending (not accepted) invite where:
  - `ProfessionalProfileId` matches the professional's profile
  - `Email` matches the client's email
  - `IsAccepted == false`
- If a pending invite exists, return:
  ```json
  {
    "type": "invite",
    "inviteId": "<invite PublicId>",
    "icon": "person-add",
    "title": "<TrainerName> invited you to collaborate",
    "sub": "<TrainerRole> · <TrainerCity>",
    "actionLabel": "Accept",
    "actionRoute": ""
  }
  ```
- If no pending invite, return `null` (204 or empty body)

**Response model — `ConversationContextResponse`:**
- `Type` (string) — context type, e.g. "invite"
- `InviteId` (Guid?) — for invite-type contexts
- `Icon` (string)
- `Title` (string)
- `Sub` (string)
- `ActionLabel` (string)
- `ActionRoute` (string)

### Mobile Changes

#### 4. Update `InviteCard` component

Simplify the card to show only:
- Coach avatar + name + role/city
- Text: "[CoachName] invites you to collaborate"
- Accept / Decline buttons

Remove the display of `invite.message` from the card (it now lives in the chat).

#### 5. Update `ConversationContext` type

Update `src/types/messages.ts` — extend the `ConversationContext` interface:

```typescript
export interface ConversationContext {
  type: string
  inviteId?: string
  icon: string
  title: string
  sub: string
  actionLabel: string
  actionRoute: string
}
```

#### 6. Update chat screen `[threadId].tsx` — invite banner with actions

The `ContextBanner` currently renders as a read-only info banner in the list footer (top of inverted list). Changes:

- Move the context banner from `ListFooterComponent` to a fixed position between the header and the message list (so it's always visible at the top, not scrolled away)
- When `context.type === 'invite'`, render the banner with accept/decline buttons instead of the generic action link
- **Accept handler:**
  - Call `POST /client/invites/{inviteId}/accept`
  - Show toast: "You and [CoachName] are now connected"
  - Invalidate queries: `conversation-context`, `client-invite`, `conversations`
  - Call `refreshProfile()` from auth store (to update `hasActiveLink`)
- **Decline handler:**
  - Call `POST /client/invites/{inviteId}/decline`
  - Invalidate queries: `conversation-context`, `client-invite`, `conversations`

#### 7. Update `ContextBanner` component

Add optional `onAccept` and `onDecline` props:

```typescript
interface ContextBannerProps {
  icon: string
  title: string
  sub: string
  actionLabel: string
  onAction: () => void
  onAccept?: () => void
  onDecline?: () => void
}
```

When `onAccept` and `onDecline` are provided, render accept/decline buttons instead of the action label link. Style the buttons similarly to the `InviteCard` buttons (gold accept, muted decline).

#### 8. Update `useClientInvite` hook

On accept success, also invalidate `conversation-context` queries so chat banners disappear across all conversations.

### Data Flow

```
Coach sends invite with message
  -> Backend: create PendingInvite + InvitationToken
  -> If existing user:
      -> Find/create Conversation
      -> Create ChatMessage with invite message
      -> SignalR: newMessage event
      -> SignalR: invitationReceived event
      -> Notification: InvitationReceived
  -> If new user:
      -> Send email with coach's message included

Client opens app:
  -> Home: InviteCard shows "[Coach] invites you to collaborate" + accept/decline
  -> Chat list: conversation appears with the coach's message
  -> Chat window: invite banner pinned at top + message in thread

Client accepts (from home OR chat banner):
  -> POST /client/invites/{id}/accept
  -> Both banners disappear (query invalidation)
  -> Toast: "You and Coach ABC are now connected"

Client declines (from home OR chat banner):
  -> POST /client/invites/{id}/decline
  -> Both banners disappear (query invalidation)
```

### Files to Modify

**Backend:**
- `Features/Trainers/PendingInvites/Create/CreatePendingInviteEndpoint.cs` — add conversation + message creation
- `Domain/Interfaces/IEmailService.cs` — add message parameter
- Email service implementation — include message in email body
- **New:** `Features/Messaging/GetConversationContext/GetConversationContextEndpoint.cs`

**Mobile:**
- `src/types/messages.ts` — extend `ConversationContext`
- `src/components/messages/ContextBanner.tsx` — add accept/decline props
- `src/components/notifications/InviteCard.tsx` — remove message display
- `app/(client)/messages/[threadId].tsx` — move banner to fixed position, wire accept/decline
- `src/hooks/useClientInvite.ts` — invalidate conversation-context on accept

### Out of Scope

- Trainer/coach web portal changes (no banner on web)
- Push notifications for invite messages (existing notification flow handles this)
- Chat message for new users who register later (they get the message in the email)
