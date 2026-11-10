'use strict';

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session reference is required'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class reference is required'],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    cameraId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camera',
      default: null,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: {
        values: ['present', 'late', 'absent'],
        message: 'Status must be one of: present, late, absent',
      },
      required: [true, 'Attendance status is required'],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    isManualOverride: {
      type: Boolean,
      default: false,
    },
    overriddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    overrideReason: {
      type: String,
      maxlength: [300, 'Override reason cannot exceed 300 characters'],
      default: null,
    },
    // Date-only field for fast range queries (YYYY-MM-DD stored as midnight UTC)
    date: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate attendance per student per session
attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });
attendanceSchema.index({ classId: 1, date: 1 });
attendanceSchema.index({ sessionId: 1, status: 1 });

// Auto-populate date from markedAt if not set
attendanceSchema.pre('save', function (next) {
  if (!this.date) {
    const d = this.markedAt || new Date();
    this.date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  next();
});

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
