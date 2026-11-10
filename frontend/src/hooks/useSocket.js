import { useEffect, useCallback } from 'react'
import { useSocketStore } from '../stores/socketStore'

/**
 * Subscribe to a Socket.IO event and unsubscribe on cleanup.
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {boolean} [enabled=true] - Whether subscription is active
 */
export function useSocket(event, handler, enabled = true) {
  const { subscribe, unsubscribe } = useSocketStore()

  const stableHandler = useCallback(handler, [handler])

  useEffect(() => {
    if (!enabled || !event) return
    subscribe(event, stableHandler)
    return () => {
      unsubscribe(event, stableHandler)
    }
  }, [event, stableHandler, enabled, subscribe, unsubscribe])
}

/** Emit a socket event */
export function useSocketEmit() {
  const { emit } = useSocketStore()
  return emit
}

/** Get current connection status */
export function useSocketStatus() {
  return useSocketStore((s) => s.isConnected)
}
