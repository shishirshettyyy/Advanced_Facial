'use strict';

const { validationResult } = require('express-validator');

/**
 * Runs express-validator's validationResult.
 * If there are errors, returns 400 with structured field errors.
 * Otherwise calls next().
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }
  next();
};

module.exports = validate;
