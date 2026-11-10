'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Wraps an async route handler and forwards errors to the global error handler.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Signs and returns a JWT token for the given user id.
 */
function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  // Explicitly select password for comparison
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(401).json({ success: false, message: 'Account has been deactivated' });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);

  logger.info(`User ${user.email} logged in`);

  res.status(200).json({
    success: true,
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
      },
    },
  });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user info.
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.status(200).json({ success: true, data: user });
});

/**
 * POST /api/auth/logout
 * JWT is stateless — instruct client to discard the token.
 */
const logout = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

/**
 * PUT /api/auth/change-password
 * Body: { oldPassword, newPassword }
 */
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Both oldPassword and newPassword are required',
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters',
    });
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(oldPassword))) {
    return res.status(401).json({ success: false, message: 'Old password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  logger.info(`User ${user.email} changed their password`);

  res.status(200).json({ success: true, message: 'Password changed successfully' });
});

module.exports = { login, getMe, logout, changePassword };
