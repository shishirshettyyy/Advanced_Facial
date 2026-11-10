import api from '../utils/api'

/** Login and return { user, token } */
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

/** Server-side logout (invalidate session) */
export async function logout() {
  await api.post('/auth/logout')
}

/** Get the currently authenticated user */
export async function getMe() {
  const { data } = await api.get('/auth/me')
  return data
}

/** Change user password */
export async function changePassword(oldPassword, newPassword) {
  const { data } = await api.put('/auth/change-password', { oldPassword, newPassword })
  return data
}
