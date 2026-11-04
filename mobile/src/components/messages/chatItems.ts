import { ChatEventType, ChatMessageKind } from '@/api/generated';
import type { ChatMessage } from '@/api/conversations';

type Entry =
  | { kind: 'message'; key: string; message: ChatMessage }
  | {
      kind: 'card';
      key: string;
      /** The Invited, Requested or ProposalSent row the card is drawn from; its eventStatus is the label. */
      message: ChatMessage;
      /** Timestamp of the row that settled the card, when there is one. */
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

const OPENING_EVENTS: readonly ChatEventType[] = [
  ChatEventType.Invited,
  ChatEventType.Requested,
  ChatEventType.ProposalSent,
];

const dayKey = (iso: string | undefined): string => {
  const parsed = iso ? new Date(iso) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toDateString() : '';
};

/** A request and its proposal share one source id, so a card is told apart by id and event type. */
const cardKey = (sourceId: string, eventType: ChatEventType): string => `${sourceId}|${eventType}`;

/**
 * Turns the newest-first messages into list items: one card per invite, request or proposal, with
 * the rows that answered it hidden and their time lent to the nearest earlier card of the same source.
 */
export function buildChatItems(messages: ChatMessage[]): ChatItem[] {
  // Walk oldest to newest so a settling row meets the card it answers, not a later one.
  const settledAt = new Map<string, string>();
  const openCard = new Map<string, string>();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const sourceId = message.eventSourceId;
    const eventType = message.eventType;
    if (message.kind !== ChatMessageKind.Event || !sourceId || !eventType) continue;
    if (OPENING_EVENTS.includes(eventType)) {
      openCard.set(sourceId, cardKey(sourceId, eventType));
    } else if (SETTLING_EVENTS.includes(eventType) && message.timestamp) {
      const key = openCard.get(sourceId);
      if (key) settledAt.set(key, message.timestamp);
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
    const id = cardKey(sourceId, message.eventType);
    if (seenCards.has(id)) continue;
    seenCards.add(id);
    visible.push({ kind: 'card', key, message, settledAt: settledAt.get(id) });
  }

  // Newest first, so an item opens its day when the next one is from an earlier day.
  return visible.map((item, index) => ({
    ...item,
    dayStart: dayKey(item.message.timestamp) !== dayKey(visible[index + 1]?.message.timestamp),
  }));
}
