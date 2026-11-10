// auth.js - authentication, sessions, role checks, CSRF (Student B).
const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcryptjs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Valid bcrypt hash used so a login for an unknown email costs the same time as a real one.
const DUMMY_HASH = '$2b$12$4.9nqWJsE3sptHh0M2OROeh4YsdRRqUrX5ON.YOpvls1ypb/ywly6';

const newCsrfToken = () => crypto.randomBytes(32).toString('hex');

function sendError(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

// ---------- middleware ----------

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'Please log in.');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.user) return sendError(res, 401, 'UNAUTHENTICATED', 'Please log in.');
    if (req.session.user.role !== role) return sendError(res, 403, 'FORBIDDEN', 'Not allowed.');
    next();
  };
}

// Synchroniser-token CSRF: state-changing requests must send the session's token in X-CSRF-Token.
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('x-csrf-token');
  const expected = req.session?.csrfToken;
  if (typeof sent !== 'string' || !expected || sent.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) {
    return sendError(res, 403, 'CSRF_INVALID', 'Missing or invalid CSRF token.');
  }
  next();
}

/**
 * Non-secret reference for a session, for security_events.session_ref (used by Student C).
 * HMAC of the session id - the raw session id / cookie is never logged.
 * Visitors without a stored session get a per-request value, which is fine for this prototype.
 */
function getSessionRef(req) {
  if (!req.sessionID) return null;
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'dev-only')
    .update(req.sessionID)
    .digest('hex')
    .slice(0, 16);
}

// ---------- routes ----------

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => sendError(res, 429, 'TOO_MANY_ATTEMPTS', 'Too many login attempts. Try later.'),
});

// GET /api/auth/csrf - get a token before logging in (also creates the pre-login session).
router.get('/csrf', (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = newCsrfToken();
  res.json({ csrfToken: req.session.csrfToken });
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!EMAIL_RE.test(email) || email.length > 254 || password.length < 1 || password.length > 128) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'A valid email and password are required.');
    }

    const rows = await db.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return sendError(res, 401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');

    // New session id on login (prevents session fixation).
    await promisify(req.session.regenerate.bind(req.session))();
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    req.session.csrfToken = newCsrfToken();
    await promisify(req.session.save.bind(req.session))();

    res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await promisify(req.session.destroy.bind(req.session))();
    res.clearCookie('trapdoor.sid');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = newCsrfToken();
  res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
});

module.exports = { router, requireAuth, requireRole, csrfProtection, getSessionRef, sendError };
