'use strict';

const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Camera = require('../models/Camera');
const { decrypt } = require('../utils/encryption');
const pythonService = require('../services/pythonService');
const logger = require('../config/logger');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * POST /api/sessions/start
 * Body: { classId, subjectId, cameraIds, lateThresholdMinutes, notes }
 */
const startSession = asyncHandler(async (req, res) => {
  const { classId, subjectId, cameraIds = [], lateThresholdMinutes, notes } = req.body;

  if (!classId || !subjectId) {
    return res.status(400).json({ success: false, message: 'classId and subjectId are required' });
  }

  const session = await Session.create({
    classId,
    subjectId,
    lecturerId: req.user._id,
    cameraIds,
    startTime: new Date(),
    isActive: true,
    lateThresholdMinutes: lateThresholdMinutes || 15,
    notes,
  });

  // Notify Python CV service to start processing for each camera
  if (cameraIds.length > 0) {
    const cameras = await Camera.find({ _id: { $in: cameraIds }, isActive: true });

    for (const camera of cameras) {
      try {
        const rtspUrl = camera.rtspUrl ? decrypt(camera.rtspUrl) : null;
        await pythonService.startCameraStream(camera._id.toString(), rtspUrl, session._id.toString());
        camera.status = 'online';
        camera.lastSeen = new Date();
        await camera.save();
      } catch (err) {
        logger.warn(`Failed to start camera ${camera._id} for session ${session._id}: ${err.message}`);
      }
    }
  }

  await session.populate([
    { path: 'classId', select: 'name code' },
    { path: 'subjectId', select: 'name code' },
    { path: 'lecturerId', select: 'name email' },
  ]);

  logger.info(`Session started: ${session._id} by ${req.user.email}`);
  res.status(201).json({ success: true, data: session });
});

/**
 * POST /api/sessions/:id/end
 */
const endSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (!session.isActive) {
    return res.status(400).json({ success: false, message: 'Session is already ended' });
  }

  session.isActive = false;
  session.endTime = new Date();
  await session.save();

  // Stop cameras on Python CV service
  if (session.cameraIds.length > 0) {
    for (const cameraId of session.cameraIds) {
      try {
        await pythonService.stopCameraStream(cameraId.toString());
      } catch (err) {
        logger.warn(`Failed to stop camera ${cameraId} for session ${session._id}: ${err.message}`);
      }
    }
  }

  // Update attendance count
  const count = await Attendance.countDocuments({ sessionId: session._id, status: { $ne: 'absent' } });
  session.attendanceCount = count;
  await session.save();

  logger.info(`Session ended: ${session._id}`);
  res.status(200).json({ success: true, data: session });
});

/**
 * GET /api/sessions/active
 */
const getActiveSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ isActive: true })
    .populate('classId', 'name code')
    .populate('subjectId', 'name code')
    .populate('lecturerId', 'name email')
    .populate('cameraIds', 'name status location')
    .sort({ startTime: -1 });

  res.status(200).json({ success: true, data: sessions });
});

/**
 * GET /api/sessions
 * Query: page, limit, classId, subjectId, lecturerId, isActive, startDate, endDate
 */
const getSessions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.lecturerId) filter.lecturerId = req.query.lecturerId;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  if (req.query.startDate || req.query.endDate) {
    filter.startTime = {};
    if (req.query.startDate) filter.startTime.$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter.startTime.$lte = new Date(req.query.endDate);
  }

  const [sessions, total] = await Promise.all([
    Session.find(filter)
      .populate('classId', 'name code')
      .populate('subjectId', 'name code')
      .populate('lecturerId', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ startTime: -1 }),
    Session.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      sessions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    },
  });
});

/**
 * GET /api/sessions/:id
 */
const getSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
    .populate('classId', 'name code department')
    .populate('subjectId', 'name code')
    .populate('lecturerId', 'name email')
    .populate('cameraIds', 'name status location');

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const attendanceCount = await Attendance.countDocuments({ sessionId: session._id });
  const presentCount = await Attendance.countDocuments({ sessionId: session._id, status: 'present' });
  const lateCount = await Attendance.countDocuments({ sessionId: session._id, status: 'late' });

  res.status(200).json({
    success: true,
    data: {
      ...session.toObject(),
      stats: { total: attendanceCount, present: presentCount, late: lateCount },
    },
  });
});

module.exports = { startSession, endSession, getActiveSessions, getSessions, getSession };
