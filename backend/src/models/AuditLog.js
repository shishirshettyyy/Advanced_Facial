'use strict';

const mongoose = require('mongoose');

const NINETY_DAYS_IN_SECONDS = 90 * 24 * 60 * 60;

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      maxlength: [100, 'Action cannot exceed 100 characters'],
    },
    resource: {
      type: String,
      required: [true, 'Resource is required'],
      trim: true,
      maxlength: [100, 'Resource name cannot exceed 100 characters'],
    },
    resourceId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: [45, 'IP address cannot exceed 45 characters'],
      default: null,
    },
    userAgent: {
      type: String,
      maxlength: [500, 'User agent cannot exceed 500 characters'],
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// TTL index: auto-delete after 90 days
auditLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: NINETY_DAYS_IN_SECONDS }
);

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, action: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
