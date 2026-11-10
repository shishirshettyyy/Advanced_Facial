'use strict';

const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Audit logger middleware.
 * Logs POST, PUT, PATCH, DELETE requests to AuditLog after the response is sent.
 */
const auditLogger = (req, res, next) => {
  const LOGGED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!LOGGED_METHODS.includes(req.method)) {
    return next();
  }

  // Capture after response finishes
  res.on('finish', async () => {
    try {
      // Determine resource name from URL path
      const pathParts = req.originalUrl.split('/').filter(Boolean);
      // Typically: /api/<resource>/... or /api/internal/...
      const resource = pathParts[1] || pathParts[0] || 'unknown';

      // Try to extract resourceId from params
      const resourceId = req.params.id || req.params.sessionId || req.params.studentId || null;

      // Build action string: METHOD /path
      const action = `${req.method} ${req.originalUrl.split('?')[0]}`;

      // Don't log password fields in body
      let details = null;
      if (req.body && Object.keys(req.body).length > 0) {
        const sanitized = { ...req.body };
        delete sanitized.password;
        delete sanitized.newPassword;
        delete sanitized.oldPassword;
        delete sanitized.confirmPassword;
        details = sanitized;
      }

      await AuditLog.create({
        userId: req.user ? req.user._id : null,
        action,
        resource,
        resourceId,
        details,
        ipAddress:
          req.headers['x-forwarded-for']?.split(',')[0].trim() ||
          req.socket?.remoteAddress ||
          null,
        userAgent: req.headers['user-agent'] || null,
        timestamp: new Date(),
      });
    } catch (err) {
      // Audit log failures should never crash the app
      logger.error(`AuditLog write failed: ${err.message}`);
    }
  });

  next();
};

module.exports = auditLogger;
