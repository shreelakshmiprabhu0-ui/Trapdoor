
/**
 * trap.routes.js — Student C
 *
 * Handlers for the configured trap routes.
 *
 * GET / HEAD:
 *   Log one event and return the synthetic JSON.
 *
 * Other HTTP methods:
 *   Log one event and return 405.
 *
 * Matching is exact: case-sensitive, no trailing slash,
 * no wildcards and no sub-paths.
 */

const express = require('express');
const { TRAP_PATHS, getDecoyResponse } = require('./trapData');
const { logTrapAccess } = require('./eventLogger');

const router = express.Router({
  caseSensitive: true,
  strict: true,
});

// Forward async errors to Express error middleware.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res)).catch(next);
};

// GET and HEAD requests for configured trap routes.
async function serveDecoy(req, res) {
  await logTrapAccess(req);

  const body = getDecoyResponse(req.path);

  res.set('Cache-Control', 'no-store');

  return res.status(200).json(body);
}

// Reject other methods on configured trap routes.
async function rejectMethod(req, res) {
  await logTrapAccess(req);

  res.set('Allow', 'GET, HEAD');

  return res.status(405).json({
    error: 'Method Not Allowed',
  });
}

// Browser-facing fake admin login.
// Credentials are never persisted or logged.
router.post(
  '/api/internal/admin/login',
  asyncHandler(async (req, res) => {
    const username = typeof req.body?.username === 'string'
      ? req.body.username.trim().slice(0, 80)
      : '';

    const password = typeof req.body?.password === 'string'
      ? req.body.password
      : '';

    const validDemoLogin =
      username === 'demo_admin' &&
      password === 'TrapdoorDemo!2026';

    await logTrapAccess(req, {
      route: '/api/internal/admin/login',
      method: 'POST',
      eventType: validDemoLogin
        ? 'DECOY_ADMIN_LOGIN_SUCCESS'
        : 'DECOY_ADMIN_LOGIN_FAILURE',
      details: {
        username: username || 'blank',
        outcome: validDemoLogin
          ? 'simulated_success'
          : 'simulated_failure',
      },
    });

    res.set('Cache-Control', 'no-store');

    return res.json({
      ok: true,
      authenticated: validDemoLogin,
      outcome: validDemoLogin ? 'success' : 'failure',
    });
  })
);

// Register the original exact-match trap routes.
TRAP_PATHS.forEach((trapPath) => {
  router
    .route(trapPath)
    .get(asyncHandler(serveDecoy))
    .all(asyncHandler(rejectMethod));
});

module.exports = router;
