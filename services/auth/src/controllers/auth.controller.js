// services/auth/src/controllers/auth.controller.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, transaction } = require('../shared/db');
const { success, error, unauthorized, created } = require('../shared/response');
const logger = require('../shared/logger');

const ACCESS_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

// ── Token generators ──
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      plantIds: user.plant_ids || [],
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

// ── POST /api/auth/login ──
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const { rows } = await query(
      `SELECT u.*, ARRAY_AGG(up.plant_id) FILTER (WHERE up.plant_id IS NOT NULL) AS plant_ids
       FROM users u
       LEFT JOIN user_plants up ON u.id = up.user_id
       WHERE u.email = $1 AND u.is_active = TRUE
       GROUP BY u.id`,
      [email.toLowerCase()]
    );

    const user = rows[0];
    if (!user) return unauthorized(res, 'Invalid email or password');

    // 2. Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return unauthorized(res, 'Invalid email or password');

    // 3. Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await transaction(async (client) => {
      // Store refresh token
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
      // Update last login
      await client.query(
        `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
        [user.id]
      );
      // Audit log
      await client.query(
        `INSERT INTO audit_log (user_id, action, ip_address)
         VALUES ($1, 'LOGIN', $2)`,
        [user.id, req.ip]
      );
    });

    // 4. Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, // required for SameSite='none'
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return success(res, {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        plantIds: user.plant_ids,
      },
    }, 'Login successful');

  } catch (err) {
    console.log(err);
    logger.error('Login error', { message: err.message });
    return error(res, 'Login failed', 500);
  }
};

// ── POST /api/auth/refresh ──
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return unauthorized(res, 'No refresh token');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await query(
      `SELECT rt.*, u.id AS uid, u.email, u.role, u.is_active,
              ARRAY_AGG(up.plant_id) FILTER (WHERE up.plant_id IS NOT NULL) AS plant_ids
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       LEFT JOIN user_plants up ON u.id = up.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW()
       GROUP BY rt.id, u.id`,
      [tokenHash]
    );

    const tokenRow = rows[0];
    if (!tokenRow || !tokenRow.is_active) return unauthorized(res, 'Invalid or expired refresh token');

    const user = { id: tokenRow.uid, email: tokenRow.email, role: tokenRow.role, plant_ids: tokenRow.plant_ids };
    const newAccessToken = generateAccessToken(user);

    return success(res, { accessToken: newAccessToken }, 'Token refreshed');

  } catch (err) {
    logger.error('Refresh error', { message: err.message });
    return error(res, 'Token refresh failed', 500);
  }
};

// ── POST /api/auth/logout ──
exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
    }
    res.clearCookie('refreshToken');
    return success(res, {}, 'Logged out successfully');
  } catch (err) {
    logger.error('Logout error', { message: err.message });
    return error(res, 'Logout failed', 500);
  }
};

// ── GET /api/auth/me ──
exports.me = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.employee_id, u.last_login_at,
              ARRAY_AGG(p.id ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL) AS plant_ids,
              ARRAY_AGG(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL) AS plant_names
       FROM users u
       LEFT JOIN user_plants up ON u.id = up.user_id
       LEFT JOIN plants p ON up.plant_id = p.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.sub]
    );
    const user = rows[0];
    if (!user) return unauthorized(res);
    return success(res, user);
  } catch (err) {
    logger.error('Me error', { message: err.message });
    return error(res, 'Failed to fetch user', 500);
  }
};

// ── POST /api/auth/change-password ──
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.sub]);
    const user = rows[0];
    if (!user) return unauthorized(res);

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return unauthorized(res, 'Current password incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, req.user.sub]);
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [req.user.sub]);

    res.clearCookie('refreshToken');
    return success(res, {}, 'Password changed. Please login again.');
  } catch (err) {
    logger.error('Change password error', { message: err.message });
    return error(res, 'Failed to change password', 500);
  }
};
