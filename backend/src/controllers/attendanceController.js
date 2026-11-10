'use strict';

const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Student = require('../models/Student');
const logger = require('../config/logger');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/attendance
 * Filters: sessionId, studentId, classId, status, startDate, endDate, page, limit
 */
const getAttendance = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.sessionId) filter.sessionId = req.query.sessionId;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.status) filter.status = req.query.status;

  if (req.query.startDate || req.query.endDate) {
    filter.date = {};
    if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
  }

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('studentId', 'name studentId email')
      .populate('sessionId', 'startTime endTime')
      .populate('classId', 'name code')
      .populate('subjectId', 'name code')
      .skip(skip)
      .limit(limit)
      .sort({ markedAt: -1 }),
    Attendance.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      records,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    },
  });
});

/**
 * POST /api/attendance/manual
 * Body: { studentId, sessionId, status, overrideReason }
 * Creates or updates (override) attendance for a student in a session.
 */
const markManual = asyncHandler(async (req, res) => {
  const { studentId, sessionId, status, overrideReason } = req.body;

  if (!studentId || !sessionId || !status) {
    return res.status(400).json({
      success: false,
      message: 'studentId, sessionId, and status are required',
    });
  }

  const validStatuses = ['present', 'late', 'absent'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Status must be one of: ${validStatuses.join(', ')}`,
    });
  }

  const session = await Session.findById(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const student = await Student.findById(studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const now = new Date();
  const dateOnly = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const record = await Attendance.findOneAndUpdate(
    { studentId, sessionId },
    {
      $set: {
        status,
        isManualOverride: true,
        overriddenBy: req.user._id,
        overrideReason: overrideReason || null,
        markedAt: now,
        classId: session.classId,
        subjectId: session.subjectId,
        date: dateOnly,
        confidence: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info(`Manual attendance: student=${studentId} session=${sessionId} status=${status} by=${req.user.email}`);

  res.status(200).json({ success: true, data: record });
});

/**
 * GET /api/attendance/session/:sessionId
 * All attendance for a specific session.
 */
const getSessionAttendance = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await Session.findById(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const records = await Attendance.find({ sessionId })
    .populate('studentId', 'name studentId email phone')
    .populate('cameraId', 'name location')
    .sort({ markedAt: 1 });

  const stats = {
    total: records.length,
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    absent: records.filter((r) => r.status === 'absent').length,
  };

  res.status(200).json({ success: true, data: { session, records, stats } });
});

/**
 * GET /api/attendance/report/daily
 * Query: date (YYYY-MM-DD), classId
 */
const getDailyReport = asyncHandler(async (req, res) => {
  const { date, classId } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD)' });
  }

  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format' });
  }

  const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const filter = { date: { $gte: startOfDay, $lte: endOfDay } };
  if (classId) filter.classId = classId;

  const records = await Attendance.find(filter)
    .populate('studentId', 'name studentId')
    .populate('sessionId', 'startTime endTime')
    .populate('subjectId', 'name');

  const summary = {
    date,
    total: records.length,
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    absent: records.filter((r) => r.status === 'absent').length,
    attendanceRate:
      records.length > 0
        ? (((records.filter((r) => r.status !== 'absent').length) / records.length) * 100).toFixed(1)
        : 0,
  };

  res.status(200).json({ success: true, data: { summary, records } });
});

/**
 * GET /api/attendance/report/student/:studentId
 * Attendance history across sessions for a student.
 * Query: page, limit, startDate, endDate
 */
const getStudentReport = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const skip = (page - 1) * limit;

  const student = await Student.findById(studentId).populate('classId', 'name code');
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const filter = { studentId };
  if (req.query.startDate || req.query.endDate) {
    filter.date = {};
    if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
  }

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('sessionId', 'startTime endTime')
      .populate('subjectId', 'name code')
      .populate('classId', 'name code')
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 }),
    Attendance.countDocuments(filter),
  ]);

  const allRecords = await Attendance.find({ studentId });
  const overall = {
    total: allRecords.length,
    present: allRecords.filter((r) => r.status === 'present').length,
    late: allRecords.filter((r) => r.status === 'late').length,
    absent: allRecords.filter((r) => r.status === 'absent').length,
    attendanceRate:
      allRecords.length > 0
        ? (((allRecords.filter((r) => r.status !== 'absent').length) / allRecords.length) * 100).toFixed(1)
        : 0,
  };

  res.status(200).json({
    success: true,
    data: {
      student,
      overall,
      records,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    },
  });
});

module.exports = { getAttendance, markManual, getSessionAttendance, getDailyReport, getStudentReport };
