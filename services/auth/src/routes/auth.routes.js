// services/auth/src/routes/auth.routes.js
const router = require('express').Router();
const Joi    = require('joi');
const ctrl   = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validationError } = require('../shared/response');

// ── Validation middleware ──
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return validationError(res, error.details.map(d => d.message));
  next();
};

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const changePassSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword:     Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*[0-9])/).required()
    .messages({ 'string.pattern.base': 'Password must contain at least 1 uppercase letter and 1 number' }),
});

// ── Public routes ──
router.post('/login',   validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refreshToken);

// ── Protected routes ──
router.post('/logout',          authenticate, ctrl.logout);
router.get('/me',               authenticate, ctrl.me);
router.post('/change-password', authenticate, validate(changePassSchema), ctrl.changePassword);

module.exports = router;
