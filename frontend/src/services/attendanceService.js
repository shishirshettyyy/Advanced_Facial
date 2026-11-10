import api from '../utils/api'

export async function getAttendance(params = {}) {
  const { data } = await api.get('/attendance', { params })
  return data
}

export async function markManual(payload) {
  const { data } = await api.post('/attendance/manual', payload)
  return data
}

export async function getSessionAttendance(sessionId) {
  const { data } = await api.get(`/attendance/session/${sessionId}`)
  return data
}

export async function getDailyReport(date) {
  const { data } = await api.get('/attendance/report/daily', { params: { date } })
  return data
}

export async function getStudentReport(studentId) {
  const { data } = await api.get(`/attendance/report/student/${studentId}`)
  return data
}

export async function getSessions(params = {}) {
  const { data } = await api.get('/sessions', { params })
  return data
}

export async function startSession(payload) {
  const { data } = await api.post('/sessions/start', payload)
  return data
}

export async function endSession(sessionId) {
  const { data } = await api.post(`/sessions/${sessionId}/end`)
  return data
}
