import { create } from 'zustand'
import { io } from 'socket.io-client'

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,

  connect(token) {
    // Don't create duplicate connections
    const existing = get().socket
    if (existing?.connected) return

    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socket.on('connect', () => {
      set({ isConnected: true })
    })

    socket.on('disconnect', () => {
      set({ isConnected: false })
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message)
      set({ isConnected: false })
    })

    set({ socket })
  },

  disconnect() {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },

  subscribe(event, handler) {
    const { socket } = get()
    if (socket) {
      socket.on(event, handler)
    }
  },

  unsubscribe(event, handler) {
    const { socket } = get()
    if (socket) {
      socket.off(event, handler)
    }
  },

  emit(event, data) {
    const { socket } = get()
    if (socket?.connected) {
      socket.emit(event, data)
    }
  },
}))
