import { ChatEventType, ChatMessageKind } from '@/api/generated';
import type { ChatMessage } from '@/api/conversations';

type Entry =
  | { kind: 'message'; key: string; message: ChatMessage }
  | {
      kind: 'card';
      key: string;
      /** The Invited or Requested row the card is drawn from; its eventStatus is the label. */
      message: ChatMessage;
      /** Timestamp of the row that settled the invite or request, when there is one. */
      settledAt: string | undefined;
    };

export type ChatItem = Entry & {
  /** True for the oldest item of a calendar day, which gets a time separator above it. */
  dayStart: boolean;
};

const SETTLING_EVENTS: readonly ChatEventType[] = [
  ChatEventType.Accepted,
  ChatEventType.Declined,
  ChatEventType.Withdrawn,
];

const OPENING_EVENTS: readonly ChatEventType[] = [ChatEventType.Invited, ChatEventType.Requested];

const dayKey = (iso: string | undefined): string => {
  const parsed = iso ? new Date(iso) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toDateString() : '';
};

/**
 * Turns the newest-first messages into list items: one card per invite or request, with the
 * rows that answered it hidden and their time lent to the card.
 */
export function buildChatItems(messages: ChatMessage[]): ChatItem[] {
  const settledAt = new Map<string, string>();
  for (const message of messages) {
    if (
      message.kind === ChatMessageKind.Event &&
      message.eventType &&
      SETTLING_EVENTS.includes(message.eventType) &&
      message.eventSourceId &&
      message.timestamp &&
      !settledAt.has(message.eventSourceId)
    ) {
      settledAt.set(message.eventSourceId, message.timestamp);
    }
  }

  const visible: Entry[] = [];
  const seenCards = new Set<string>();
  for (const message of messages) {
    const key = message.id ?? `${message.timestamp ?? ''}-${visible.length}`;
    if (message.kind !== ChatMessageKind.Event) {
      visible.push({ kind: 'message', key, message });
      continue;
    }
    const sourceId = message.eventSourceId;
    if (!sourceId || !message.eventType || !OPENING_EVENTS.includes(message.eventType)) continue;
    if (seenCards.has(sourceId)) continue;
    seenCards.add(sourceId);
    visible.push({ kind: 'card', key, message, settledAt: settledAt.get(sourceId) });
  }

  // Newest first, so an item opens its day when the next one is from an earlier day.
  return visible.map((item, index) => ({
    ...item,
    dayStart: dayKey(item.message.timestamp) !== dayKey(visible[index + 1]?.message.timestamp),
  }));
}
