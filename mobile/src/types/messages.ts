export interface Participant {
  id: string
  name: string
  initials: string
  online: boolean
}

export interface Conversation {
  id: string
  participant: Participant
  lastMessage: string
  lastMessageAt: string
  lastMessageIsOwn: boolean
  unreadCount: number
  isFormer: boolean
}

export type MessageStatus = 'sent' | 'sending' | 'error'

export interface Message {
  id: string
  senderId: string
  text: string
  timestamp: string
  isRead: boolean
  status?: MessageStatus
}

export interface PlanAttachment {
  planId: string
  planType: 'training' | 'nutrition'
  planName: string
  meta: string
  gradientStart: string
  gradientEnd: string
}

export interface ConversationContext {
  type: string
  inviteId?: string
  icon: string
  title: string
  sub: string
  actionLabel: string
  actionRoute: string
}
