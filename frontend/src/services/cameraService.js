import api from '../utils/api'

export async function getCameras(params = {}) {
  const { data } = await api.get('/cameras', { params })
  return data
}

export async function getCamera(id) {
  const { data } = await api.get(`/cameras/${id}`)
  return data
}

export async function createCamera(payload) {
  const { data } = await api.post('/cameras', payload)
  return data
}

export async function updateCamera(id, payload) {
  const { data } = await api.put(`/cameras/${id}`, payload)
  return data
}

export async function deleteCamera(id) {
  const { data } = await api.delete(`/cameras/${id}`)
  return data
}

/** Test RTSP/USB connection — returns { success, resolution, fps, error? } */
export async function testCamera(id) {
  const { data } = await api.post(`/cameras/${id}/test`, {}, { timeout: 20000 })
  return data
}

export async function startCamera(id) {
  const { data } = await api.post(`/cameras/${id}/start`)
  return data
}

export async function stopCamera(id) {
  const { data } = await api.post(`/cameras/${id}/stop`)
  return data
}

/** Get MJPEG stream URL for a camera */
export function getCameraStreamUrl(id) {
  return `/api/cameras/${id}/stream`
}
