import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login(user, token) {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },

  logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadFromStorage() {
    try {
      const token = localStorage.getItem('auth_token')
      const userRaw = localStorage.getItem('auth_user')
      if (token && userRaw) {
        const user = JSON.parse(userRaw)
        set({ user, token, isAuthenticated: true })
      }
    } catch {
      // corrupted storage — clear it
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
  },

  updateUser(updates) {
    const user = { ...get().user, ...updates }
    localStorage.setItem('auth_user', JSON.stringify(user))
    set({ user })
  },
}))
