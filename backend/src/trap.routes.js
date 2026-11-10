/**
 * trap.routes.js — Student C
 *
 * Handlers for the configured trap routes.
 *
 * Behaviour, per trap path in trapData.js:
 *   GET / HEAD      -> log one event, return the synthetic JSON (200)
 *   any other verb  -> log one event, return 405 with "Allow: GET, HEAD"
 *                      (no decoy content is sent for these)
 *   any other path  -> this router does nothing; the request carries on
 *                      to Student B's normal routes
 *
 * Matching is exact: case-sensitive, no trailing slash, no wildcards, no
 * sub-paths. Query strings are ignored (Express removes them from the path).
 *
 * Student B mounts this router in app.js (see docs/API_CONTRACT.md):
 *   - AFTER the session middleware (so a session reference can be recorded)
 *   - BEFORE the CSRF middleware and the auth/portal/defender routes
 *     (so every method reaches the trap path and is logged)
 *       const trapRouter = require('./trap.routes');
 *       app.use(trapRouter);
 *
 * This file does NOT import db.js, read process.env, redirect the browser,
 * or keep any risk score or session state.
 */

const express = require('express');
const { TRAP_PATHS, getDecoyResponse } = require('./trapData');
const { logTrapAccess } = require('./eventLogger');

// Express is normally forgiving ("/ADMIN" and "/admin/" would match
// "/admin"). Turn that off so only the exact configured path matches.
const router = express.Router({ caseSensitive: true, strict: true });

// Express 4 does not catch errors from async handlers on its own,
// so forward them to the error middleware ourselves.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res)).catch(next);
};

// GET (and HEAD, which Express serves from the GET handler).
async function serveDecoy(req, res) {
  await logTrapAccess(req); // never throws; a failed write is reported to stderr

  const body = getDecoyResponse(req.path);
  res.set('Cache-Control', 'no-store');
  return res.status(200).json(body);
}

// Every other HTTP method on a trap path.
async function rejectMethod(req, res) {
  await logTrapAccess(req); // a POST/DELETE probe is still worth recording

  res.set('Allow', 'GET, HEAD');
  return res.status(405).json({ error: 'Method Not Allowed' });
}


// Browser-facing decoy login. This is deliberately separate from the existing
// GET /api/internal/admin JSON endpoint. Credentials are never persisted or logged.
router.post('/api/internal/admin/login', asyncHandler(async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 80) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const validDemoLogin = username === 'demo_admin' && password === 'TrapdoorDemo!2026';
  await logTrapAccess(req, {
    route: '/api/internal/admin/login',
    method: 'POST',
    eventType: validDemoLogin ? 'DECOY_ADMIN_LOGIN_SUCCESS' : 'DECOY_ADMIN_LOGIN_FAILURE',
    details: { username: username || 'blank', outcome: validDemoLogin ? 'simulated_success' : 'simulated_failure' },
  });
  res.set('Cache-Control', 'no-store');
  return res.json({ ok: true, authenticated: validDemoLogin, outcome: validDemoLogin ? 'success' : 'failure' });
}));

TRAP_PATHS.forEach((trapPath) => {
  router
    .route(trapPath)
    .get(asyncHandler(serveDecoy))
    .all(asyncHandler(rejectMethod));
});

module.exports = router;
