import api from '../utils/api'

export async function getOverview() {
  const { data } = await api.get('/dashboard/overview')
  return data
}

export async function getAttendanceTrend(days = 7) {
  const { data } = await api.get('/dashboard/trend', { params: { days } })
  return data
}

export async function getTopAbsentees(limit = 10) {
  const { data } = await api.get('/dashboard/top-absentees', { params: { limit } })
  return data
}

export async function getSystemStatus() {
  const { data } = await api.get('/dashboard/status')
  return data
}
