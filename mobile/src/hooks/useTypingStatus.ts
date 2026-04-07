import { useCallback, useEffect, useRef, useState } from 'react'
import { getConnection, onEvent } from '../api/signalr'

export function useTypingStatus(threadId: string) {
  const [isTyping, setIsTyping] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen for typing events from the other participant
  useEffect(() => {
    const unsubscribe = onEvent('typing', (raw: unknown) => {
      const data = raw as { conversationId?: string } | undefined
      if (data?.conversationId !== threadId) return

      setIsTyping(true)

      // Clear after 3 seconds of no typing
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
    })

    return () => {
      unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [threadId])

  // Send typing indicator via SignalR hub method
  const lastSentRef = useRef(0)
  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastSentRef.current < 2000) return
    lastSentRef.current = now

    const conn = getConnection()
    conn.invoke('SendTyping', threadId).catch(() => {})
  }, [threadId])

  return {
    isTyping,
    notifyTyping,
  }
}
