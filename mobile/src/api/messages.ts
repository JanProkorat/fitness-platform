import api from './client'
import type {
  ConversationDto,
  MessageDto,
  ConversationContextResponse,
  GetMessagesResponse,
} from './generated'

export async function fetchConversations(archived = false): Promise<ConversationDto[]> {
  const { data } = await api.get('/conversations', { params: { archived } })
  return data
}

export async function archiveConversation(conversationId: string): Promise<void> {
  await api.patch(`/conversations/${conversationId}/archive`, {})
}

export async function unarchiveConversation(conversationId: string): Promise<void> {
  await api.patch(`/conversations/${conversationId}/unarchive`, {})
}

export async function fetchMessages(
  conversationId: string,
  cursor?: string,
): Promise<GetMessagesResponse> {
  const { data } = await api.get(`/conversations/${conversationId}/messages`, {
    params: { cursor, limit: 30 },
  })
  return data
}

export async function sendMessage(
  conversationId: string,
  text: string,
): Promise<MessageDto> {
  const { data } = await api.post(
    `/conversations/${conversationId}/messages`,
    { text },
  )
  return data
}

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`)
}

export async function fetchConversationContext(
  conversationId: string,
): Promise<ConversationContextResponse | null> {
  const { data } = await api.get(`/conversations/${conversationId}/context`)
  return data
}

export async function fetchTypingStatus(
  conversationId: string,
): Promise<{ isTyping: boolean }> {
  const { data } = await api.get(
    `/conversations/${conversationId}/typing-status`,
  )
  return data
}

export async function sendTypingIndicator(
  conversationId: string,
): Promise<void> {
  await api.post(`/conversations/${conversationId}/typing`)
}

export async function startConversation(
  participantId: string,
): Promise<ConversationDto> {
  const { data } = await api.post('/conversations', { participantId })
  return data
}
