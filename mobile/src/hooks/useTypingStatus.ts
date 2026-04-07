import { useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getConnection } from '../api/signalr'

export function useTypingStatus(threadId: string) {
  // Read typing state written by the global handler in _layout
  const { data: isTyping } = useQuery({
    queryKey: ['typing', threadId],
    queryFn: () => false,
    initialData: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

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
    isTyping: isTyping ?? false,
    notifyTyping,
  }
}
