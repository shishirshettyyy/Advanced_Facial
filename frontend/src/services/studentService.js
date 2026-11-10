import api from '../utils/api'

/** Get paginated list of students */
export async function getStudents(params = {}) {
  const { data } = await api.get('/students', { params })
  return data
}

/** Get a single student by ID */
export async function getStudent(id) {
  const { data } = await api.get(`/students/${id}`)
  return data
}

/** Create a new student */
export async function createStudent(payload) {
  const { data } = await api.post('/students', payload)
  return data
}

/** Update a student */
export async function updateStudent(id, payload) {
  const { data } = await api.put(`/students/${id}`, payload)
  return data
}

/** Delete a student */
export async function deleteStudent(id) {
  const { data } = await api.delete(`/students/${id}`)
  return data
}

/**
 * Enroll face images for a student.
 * @param {string} studentId
 * @param {Blob[]} imageFiles - Array of image Blobs (from canvas capture)
 */
export async function enrollFace(studentId, imageFiles) {
  const form = new FormData()
  imageFiles.forEach((blob, i) => {
    form.append('images', blob, `sample_${i}.jpg`)
  })
  const { data } = await api.post(`/students/${studentId}/enroll-face`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data
}

/** Get enrollment status for a student */
export async function getFaceEnrollmentStatus(studentId) {
  const { data } = await api.get(`/students/${studentId}/face-status`)
  return data
}
