'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.CAMERA_ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error('CAMERA_ENCRYPTION_KEY must be a 32-character hex string');
  }
  return Buffer.from(key, 'utf8');
}

function encryptValue(value) {
  if (!value) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store as hex: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptValue(encryptedValue) {
  if (!encryptedValue) return null;
  const key = getEncryptionKey();
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuf = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
  return decrypted.toString('utf8');
}

const cameraSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Camera name is required'],
      trim: true,
      maxlength: [100, 'Camera name cannot exceed 100 characters'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    type: {
      type: String,
      enum: {
        values: ['rtsp', 'usb', 'onvif'],
        message: 'Camera type must be one of: rtsp, usb, onvif',
      },
      required: [true, 'Camera type is required'],
    },
    // Stored encrypted
    rtspUrl: {
      type: String,
      default: null,
    },
    // Stored encrypted
    username: {
      type: String,
      default: null,
    },
    // Stored encrypted
    password: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: {
        values: ['online', 'offline', 'error', 'connecting'],
        message: 'Status must be one of: online, offline, error, connecting',
      },
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    streamPort: {
      type: Number,
      default: null,
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

// Instance methods for field-level encryption
cameraSchema.methods.encryptField = function (value) {
  return encryptValue(value);
};

cameraSchema.methods.decryptField = function (encryptedValue) {
  return decryptValue(encryptedValue);
};

// Virtual: decrypted RTSP URL (use cautiously — only return to authorized users)
cameraSchema.virtual('rtspUrlDecrypted').get(function () {
  try {
    return this.rtspUrl ? decryptValue(this.rtspUrl) : null;
  } catch {
    return null;
  }
});

const Camera = mongoose.model('Camera', cameraSchema);
module.exports = Camera;
