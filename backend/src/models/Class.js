'use strict';

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      maxlength: [100, 'Class name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Class code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, 'Class code cannot exceed 20 characters'],
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
    },
    year: {
      type: Number,
      min: [1, 'Year must be at least 1'],
      max: [10, 'Year cannot exceed 10'],
    },
    section: {
      type: String,
      trim: true,
      maxlength: [10, 'Section cannot exceed 10 characters'],
    },
    lecturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    studentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

classSchema.virtual('studentCount').get(function () {
  return this.studentIds ? this.studentIds.length : 0;
});

const Class = mongoose.model('Class', classSchema);
module.exports = Class;
