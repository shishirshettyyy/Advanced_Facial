'use strict';

const mongoose = require('mongoose');

const faceProfileSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      unique: true,
    },
    // Array of 512-d float vectors (multiple embeddings per student)
    embeddings: {
      type: [[Number]],
      default: [],
      validate: {
        validator: function (v) {
          return v.every((emb) => emb.length === 512);
        },
        message: 'Each embedding must be a 512-dimensional vector',
      },
    },
    // Single averaged 512-d float vector for fast lookup
    avgEmbedding: {
      type: [Number],
      default: [],
      validate: {
        validator: function (v) {
          return v.length === 0 || v.length === 512;
        },
        message: 'avgEmbedding must be a 512-dimensional vector or empty',
      },
    },
    // Quality score 0–1
    quality: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    sampleCount: {
      type: Number,
      default: 0,
    },
    capturedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

faceProfileSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const FaceProfile = mongoose.model('FaceProfile', faceProfileSchema);
module.exports = FaceProfile;
