'use strict';

const Camera = require('../models/Camera');
const { encrypt, decrypt } = require('../utils/encryption');
const pythonService = require('../services/pythonService');
const logger = require('../config/logger');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Strips sensitive encrypted fields from camera doc for list responses.
 */
function sanitizeCamera(camera) {
  const obj = camera.toObject ? camera.toObject() : { ...camera };
  delete obj.rtspUrl;      // raw encrypted
  delete obj.username;     // raw encrypted
  delete obj.password;     // raw encrypted
  return obj;
}

/**
 * GET /api/cameras
 * Never returns credentials in list view.
 */
const getCameras = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.status) filter.status = req.query.status;
  if (req.query.classroomId) filter.classroomId = req.query.classroomId;

  const cameras = await Camera.find(filter).populate('classroomId', 'name code').sort({ name: 1 });

  const result = cameras.map((cam) => {
    const obj = sanitizeCamera(cam);
    // Show decrypted rtspUrl in listing (but no username/password)
    try {
      obj.rtspUrlDisplay = cam.rtspUrl ? decrypt(cam.rtspUrl) : null;
    } catch {
      obj.rtspUrlDisplay = null;
    }
    return obj;
  });

  res.status(200).json({ success: true, data: result });
});

/**
 * GET /api/cameras/:id
 * Returns decrypted credentials only to admin or lecturer.
 */
const getCamera = asyncHandler(async (req, res) => {
  const camera = await Camera.findById(req.params.id).populate('classroomId', 'name code');

  if (!camera) {
    return res.status(404).json({ success: false, message: 'Camera not found' });
  }

  const obj = camera.toObject();

  // Decrypt sensitive fields for admin/lecturer
  if (req.user && ['admin', 'lecturer'].includes(req.user.role)) {
    try { obj.rtspUrlDecrypted = camera.rtspUrl ? decrypt(camera.rtspUrl) : null; } catch { obj.rtspUrlDecrypted = null; }
    try { obj.usernameDecrypted = camera.username ? decrypt(camera.username) : null; } catch { obj.usernameDecrypted = null; }
    // Never return password in plain — omit for security
  }

  // Always remove raw encrypted fields from response
  delete obj.rtspUrl;
  delete obj.username;
  delete obj.password;

  res.status(200).json({ success: true, data: obj });
});

/**
 * POST /api/cameras
 * Encrypts credentials before saving.
 */
const createCamera = asyncHandler(async (req, res) => {
  const { name, location, classroomId, type, rtspUrl, username, password, streamPort, notes } = req.body;

  if (!name || !type) {
    return res.status(400).json({ success: false, message: 'Name and type are required' });
  }

  const camera = await Camera.create({
    name,
    location,
    classroomId: classroomId || null,
    type,
    rtspUrl: rtspUrl ? encrypt(rtspUrl) : null,
    username: username ? encrypt(username) : null,
    password: password ? encrypt(password) : null,
    streamPort,
    notes,
  });

  logger.info(`Camera created: ${camera.name} (${camera._id})`);

  const response = sanitizeCamera(camera);
  res.status(201).json({ success: true, data: response });
});

/**
 * PUT /api/cameras/:id
 * Re-encrypts credentials if they are changed.
 */
const updateCamera = asyncHandler(async (req, res) => {
  const camera = await Camera.findById(req.params.id);

  if (!camera) {
    return res.status(404).json({ success: false, message: 'Camera not found' });
  }

  const { name, location, classroomId, type, rtspUrl, username, password, streamPort, notes, isActive, status } = req.body;

  if (name !== undefined) camera.name = name;
  if (location !== undefined) camera.location = location;
  if (classroomId !== undefined) camera.classroomId = classroomId;
  if (type !== undefined) camera.type = type;
  if (streamPort !== undefined) camera.streamPort = streamPort;
  if (notes !== undefined) camera.notes = notes;
  if (isActive !== undefined) camera.isActive = isActive;
  if (status !== undefined) camera.status = status;

  // Re-encrypt if new credentials provided
  if (rtspUrl !== undefined) camera.rtspUrl = rtspUrl ? encrypt(rtspUrl) : null;
  if (username !== undefined) camera.username = username ? encrypt(username) : null;
  if (password !== undefined) camera.password = password ? encrypt(password) : null;

  await camera.save();

  logger.info(`Camera updated: ${camera.name} (${camera._id})`);

  const response = sanitizeCamera(camera);
  res.status(200).json({ success: true, data: response });
});

/**
 * DELETE /api/cameras/:id
 * Soft delete.
 */
const deleteCamera = asyncHandler(async (req, res) => {
  const camera = await Camera.findById(req.params.id);

  if (!camera) {
    return res.status(404).json({ success: false, message: 'Camera not found' });
  }

  camera.isActive = false;
  camera.status = 'offline';
  await camera.save();

  logger.info(`Camera soft-deleted: ${camera.name} (${camera._id})`);
  res.status(200).json({ success: true, message: 'Camera deactivated successfully' });
});

/**
 * POST /api/cameras/:id/test
 * Sends decrypted RTSP URL to Python CV service to test connectivity.
 */
const testCamera = asyncHandler(async (req, res) => {
  const camera = await Camera.findById(req.params.id);

  if (!camera) {
    return res.status(404).json({ success: false, message: 'Camera not found' });
  }

  let rtspUrl = null;
  try {
    rtspUrl = camera.rtspUrl ? decrypt(camera.rtspUrl) : null;
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to decrypt camera URL' });
  }

  if (!rtspUrl) {
    return res.status(400).json({ success: false, message: 'Camera has no RTSP URL configured' });
  }

  const result = await pythonService.testCameraConnection(rtspUrl);

  res.status(result.success ? 200 : 502).json({ success: result.success, data: result });
});

/**
 * POST /api/cameras/:id/start
 */
const startCamera = asyncHandler(async (req, res) => {
  const camera = await Camera.findById(req.params.id);

  if (!camera) {
    return res.status(404).json({ success: false, message: 'Camera not found' });
  }

  let rtspUrl = null;
  try {
    rtspUrl = camera.rtspUrl ? decrypt(camera.rtspUrl) : null;
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to decrypt camera credentials' });
  }

  camera.status = 'connecting';
  await camera.save();

  const result = await pythonService.startCameraStream(camera._id.toString(), rtspUrl);

  if (result.success) {
    camera.status = 'online';
    camera.lastSeen = new Date();
    await camera.save();
  } else {
    camera.status = 'error';
    await camera.save();
  }

  res.status(result.success ? 200 : 502).json({ success: result.success, data: result });
});

/**
 * POST /api/cameras/:id/stop
 */
const stopCamera = asyncHandler(async (req, res) => {
  const camera = await Camera.findById(req.params.id);

  if (!camera) {
    return res.status(404).json({ success: false, message: 'Camera not found' });
  }

  const result = await pythonService.stopCameraStream(camera._id.toString());

  camera.status = 'offline';
  await camera.save();

  res.status(result.success ? 200 : 502).json({ success: result.success, data: result });
});

module.exports = { getCameras, getCamera, createCamera, updateCamera, deleteCamera, testCamera, startCamera, stopCamera };
