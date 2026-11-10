'use strict';

const Student = require('../models/Student');
const Class = require('../models/Class');
const { generateStudentId } = require('../utils/generateId');
const pythonService = require('../services/pythonService');
const logger = require('../config/logger');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/students
 * Query: page, limit, search (name|studentId), classId, isActive
 */
const getStudents = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  if (req.query.classId) {
    filter.classId = req.query.classId;
  }

  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    filter.$or = [{ name: searchRegex }, { studentId: searchRegex }, { email: searchRegex }];
  }

  const [students, total] = await Promise.all([
    Student.find(filter)
      .populate('classId', 'name code')
      .skip(skip)
      .limit(limit)
      .sort({ enrolledAt: -1 }),
    Student.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      students,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * GET /api/students/:id
 */
const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('classId', 'name code department');

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  res.status(200).json({ success: true, data: student });
});

/**
 * POST /api/students
 */
const createStudent = asyncHandler(async (req, res) => {
  const { name, email, phone, classId, department, year, consentGiven } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required' });
  }

  // Auto-generate studentId
  const studentId = await generateStudentId();

  const student = await Student.create({
    studentId,
    name,
    email,
    phone,
    classId: classId || null,
    department,
    year,
    consentGiven: consentGiven || false,
    consentDate: consentGiven ? new Date() : null,
  });

  // Add student to class roster if classId provided
  if (classId) {
    await Class.findByIdAndUpdate(classId, { $addToSet: { studentIds: student._id } });
  }

  logger.info(`Student created: ${student.studentId} (${student.name})`);

  res.status(201).json({ success: true, data: student });
});

/**
 * PUT /api/students/:id
 */
const updateStudent = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'email', 'phone', 'department', 'year', 'consentGiven', 'classId'];
  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (updates.consentGiven === true) {
    updates.consentDate = new Date();
  }

  const student = await Student.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate('classId', 'name code');

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  logger.info(`Student updated: ${student.studentId}`);
  res.status(200).json({ success: true, data: student });
});

/**
 * DELETE /api/students/:id
 * Soft delete — sets isActive to false
 */
const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  student.isActive = false;
  await student.save();

  logger.info(`Student soft-deleted: ${student.studentId}`);
  res.status(200).json({ success: true, message: 'Student deactivated successfully' });
});

/**
 * POST /api/students/:id/enroll-face
 * Triggers Python CV service to register the student's face.
 * Expects multipart/form-data with field 'images' (up to 5 images).
 */
const enrollFace = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  if (!student.consentGiven) {
    return res.status(403).json({
      success: false,
      message: 'Student has not provided consent for facial recognition',
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one image is required' });
  }

  const imageBuffers = req.files.map((f) => f.buffer);

  const result = await pythonService.enrollFace(student.studentId, student._id.toString(), imageBuffers);

  if (result.success) {
    student.faceEnrolled = true;
    await student.save();
    logger.info(`Face enrolled for student: ${student.studentId}`);
    return res.status(200).json({ success: true, message: 'Face enrolled successfully', data: result });
  }

  res.status(502).json({ success: false, message: result.message || 'Face enrollment failed' });
});

module.exports = { getStudents, getStudent, createStudent, updateStudent, deleteStudent, enrollFace };
