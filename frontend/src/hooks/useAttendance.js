import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as attendanceService from '../services/attendanceService'

/** Fetch attendance records with optional filters */
export function useAttendanceQuery(filters = {}) {
  return useQuery({
    queryKey: ['attendance', filters],
    queryFn: () => attendanceService.getAttendance(filters),
    keepPreviousData: true,
  })
}

/** Mutation to manually mark attendance */
export function useManualMarkMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: attendanceService.markManual,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast.success('Attendance marked successfully')
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to mark attendance')
    },
  })
}

/** Fetch daily attendance report */
export function useDailyReport(date) {
  return useQuery({
    queryKey: ['attendance', 'daily', date],
    queryFn: () => attendanceService.getDailyReport(date),
    enabled: !!date,
  })
}

/** Fetch per-student attendance report */
export function useStudentReport(studentId) {
  return useQuery({
    queryKey: ['attendance', 'student', studentId],
    queryFn: () => attendanceService.getStudentReport(studentId),
    enabled: !!studentId,
  })
}

/** Fetch session attendance */
export function useSessionAttendance(sessionId) {
  return useQuery({
    queryKey: ['attendance', 'session', sessionId],
    queryFn: () => attendanceService.getSessionAttendance(sessionId),
    enabled: !!sessionId,
    refetchInterval: sessionId ? 10000 : false,
  })
}
