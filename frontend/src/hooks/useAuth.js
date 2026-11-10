import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { useSocketStore } from '../stores/socketStore'
import * as authService from '../services/authService'

export function useAuth() {
  const { user, token, isAuthenticated, login: storeLogin, logout: storeLogout } = useAuthStore()
  const { connect, disconnect } = useSocketStore()
  const navigate = useNavigate()

  const login = useCallback(async (email, password) => {
    const { user, token } = await authService.login(email, password)
    storeLogin(user, token)
    connect(token)
    navigate('/dashboard', { replace: true })
    toast.success(`Welcome back, ${user.name || user.email}!`)
  }, [storeLogin, connect, navigate])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      // ignore backend errors on logout
    } finally {
      storeLogout()
      disconnect()
      navigate('/login', { replace: true })
      toast.success('Logged out successfully')
    }
  }, [storeLogout, disconnect, navigate])

  return { user, token, isAuthenticated, login, logout }
}
