'use strict';

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      unique: true,
      trim: true,
      // Auto-generated via generateId utility before save
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    year: {
      type: Number,
      min: [1, 'Year must be at least 1'],
      max: [10, 'Year cannot exceed 10'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    consentGiven: {
      type: Boolean,
      default: false,
    },
    consentDate: {
      type: Date,
      default: null,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    faceEnrolled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

studentSchema.index({ studentId: 1 });
studentSchema.index({ classId: 1 });
studentSchema.index({ name: 'text', studentId: 'text' });

const Student = mongoose.model('Student', studentSchema);
module.exports = Student;
