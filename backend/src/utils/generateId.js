'use strict';

const Student = require('../models/Student');

/**
 * Generates a student ID in the format STU-YYYY-NNN
 * where YYYY is the current year and NNN is a zero-padded sequence.
 * Uses MongoDB count of students enrolled in the given year to determine next number.
 */
async function generateStudentId() {
  const year = new Date().getFullYear();
  const prefix = `STU-${year}-`;

  // Count existing students whose ID starts with this year's prefix
  const count = await Student.countDocuments({
    studentId: { $regex: `^${prefix}` },
  });

  const sequence = String(count + 1).padStart(3, '0');
  return `${prefix}${sequence}`;
}

module.exports = { generateStudentId };
