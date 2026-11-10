'use strict';

const mongoose = require('mongoose');

const TWENTY_FOUR_HOURS_IN_SECONDS = 24 * 60 * 60;
const MAX_FRAME_BYTES = 10 * 1024; // 10 KB limit for base64 thumbnail

const recognitionEventSchema = new mongoose.Schema(
  {
    cameraId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camera',
      required: [true, 'Camera reference is required'],
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null, // null if unknown face
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    boundingBox: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      w: { type: Number, default: 0 },
      h: { type: Number, default: 0 },
    },
    isUnknown: {
      type: Boolean,
      default: false,
    },
    isProcessed: {
      type: Boolean,
      default: false,
    },
    // Base64 thumbnail — max ~10 KB
    frameSnapshot: {
      type: String,
      maxlength: [MAX_FRAME_BYTES * 1.37, 'Frame snapshot exceeds 10 KB limit'], // base64 ~37% overhead
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

// TTL index: auto-delete documents 24 hours after timestamp
recognitionEventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: TWENTY_FOUR_HOURS_IN_SECONDS }
);

recognitionEventSchema.index({ sessionId: 1, isProcessed: 1 });
recognitionEventSchema.index({ isUnknown: 1, isProcessed: 1 });

const RecognitionEvent = mongoose.model('RecognitionEvent', recognitionEventSchema);
module.exports = RecognitionEvent;
