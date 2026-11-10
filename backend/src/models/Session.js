'use strict';

const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class reference is required'],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
    },
    lecturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Lecturer reference is required'],
    },
    cameraIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Camera',
      },
    ],
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lateThresholdMinutes: {
      type: Number,
      default: 15,
      min: [1, 'Late threshold must be at least 1 minute'],
    },
    attendanceCount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sessionSchema.index({ classId: 1, isActive: 1 });
sessionSchema.index({ startTime: -1 });

const Session = mongoose.model('Session', sessionSchema);
module.exports = Session;
