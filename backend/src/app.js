// app.js - wires middleware and routes (Student B owns this file; it mounts Student C's trap routes).
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');

const auth = require('./auth');
const portalRoutes = require('./portal.routes');
const defenderRoutes = require('./defender.routes');
const trapRoutes = require('./trap.routes'); // Student C: must export an express.Router

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

if (!process.env.SESSION_SECRET && isProd) {
  throw new Error('SESSION_SECRET must be set in production');
}

const app = express();

// Trap matching must be exact: /api/internal/backups/ and /API/internal/backups are NOT trap routes.
app.set('case sensitive routing', true);
app.set('strict routing', true);
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

// ---- security headers, CORS, body parsing ----
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));

// ---- server-side sessions (MySQL-backed; in-memory during tests) ----
let sessionStore;

if (!isTest) {
  const MySQLSessionStore = require('./mysqlSessionStore');
  const db = require('./db');

  sessionStore = new MySQLSessionStore({
    pool: db.pool,
  });
}

app.use(
  session({
    name: 'trapdoor.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 30 * 60 * 1000,
    },
  })
);

// ---- trap routes: explicit allowlist, handled BEFORE CSRF/auth so any visitor reaches them ----
// Non-matching paths fall through (next()) to the normal application below.
app.use(trapRoutes);

// ---- normal application ----
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', auth.csrfProtection);
app.use('/api/auth', auth.router);
app.use('/api/portal', portalRoutes);
app.use('/api/defender', defenderRoutes);

// ---- 404 and error handling (no stack traces or internals leaked) ----
app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'BAD_JSON', message: 'Invalid JSON body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'TOO_LARGE', message: 'Request body too large.' });
  }
  console.error('Unhandled error:', err.message); // message only: never log bodies or headers
  res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong.' });
});

app.closeStore = () => new Promise((resolve) => (sessionStore ? sessionStore.close(resolve) : resolve()));

module.exports = app;
