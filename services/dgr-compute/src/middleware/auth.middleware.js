// services/auth/src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../shared/response');

// ── Verify JWT access token ──
const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return unauthorized(res);

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return unauthorized(res, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }
};

// ── Role-based access ──
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.role)) return forbidden(res, 'Insufficient permissions');
  next();
};

// ── Plant-scoped access ──
// HQ management and IT admin can access all plants
// Others can only access plants assigned to them
const requirePlantAccess = (req, res, next) => {
  if (!req.user) return unauthorized(res);
  const { role, plantIds } = req.user;
  if (['hq_management', 'it_admin'].includes(role)) return next();

  const plantId = req.params.plantId || req.body.plantId || req.query.plantId;
  if (!plantId) return forbidden(res, 'Plant ID required');
  if (!plantIds.includes(plantId)) return forbidden(res, 'No access to this plant');
  next();
};

module.exports = { authenticate, authorize, requirePlantAccess };
