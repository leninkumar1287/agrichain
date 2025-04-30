const { body, validationResult } = require('express-validator');

// User validation rules
const userValidationRules = [
  body('username')
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['farmer', 'inspector', 'certificate_issuer']).withMessage('Invalid role')
];

// Certification request validation rules
const certificationValidationRules = [
  body('productName')
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 2 }).withMessage('Product name must be at least 2 characters'),
  body('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('checkpoints')
    .optional()
    .isJSON().withMessage('Checkpoints must be valid JSON')
];

// Media validation rules
const mediaValidationRules = [
  body('requestId')
    .notEmpty().withMessage('Request ID is required')
    .isUUID().withMessage('Invalid request ID format')
];

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  userValidationRules,
  certificationValidationRules,
  mediaValidationRules,
  validate
}; 