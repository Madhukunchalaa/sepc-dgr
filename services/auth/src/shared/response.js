// shared/utils/response.js

const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

const created = (res, data = {}, message = 'Created') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'Internal Server Error', statusCode = 500, details = null) => {
  const payload = { success: false, message, timestamp: new Date().toISOString() };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
};

const validationError = (res, details) => {
  return error(res, 'Validation failed', 422, details);
};

const notFound = (res, resource = 'Resource') => {
  return error(res, `${resource} not found`, 404);
};

const unauthorized = (res, msg = 'Unauthorized') => {
  return error(res, msg, 401);
};

const forbidden = (res, msg = 'Forbidden') => {
  return error(res, msg, 403);
};

// ── Custom error classes ──
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 422);
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(msg = 'Unauthorized') { super(msg, 401); }
}

class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') { super(msg, 403); }
}

module.exports = {
  success, created, error, validationError, notFound, unauthorized, forbidden,
  AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError,
};
