import type { MessageDto } from '../api/generated'

export type MessageStatus = 'sent' | 'sending' | 'error'

export type LocalMessage = MessageDto & { status?: MessageStatus }

export interface PlanAttachment {
  planId: string
  planType: 'training' | 'nutrition'
  planName: string
  meta: string
  gradientStart: string
  gradientEnd: string
}

