
/**
 * eventLogger.js — Student C
 *
 * Records security events in the security_events table.
 *
 * Dependencies on Student B:
 *   - ./db.js must export a mysql2 PROMISE pool,
 *     either directly or as { pool }.
 *   - The table security_events must exist.
 *
 * Supported event types include:
 *   TRAP_ROUTE_ACCESSED
 *   DECOY_ADMIN_LOGIN_SUCCESS
 *   DECOY_ADMIN_LOGIN_FAILURE
 *   ADMIN_PAGE_ACCESSED
 *   BACKUP_DETAILS_VIEWED
 *
 * What is stored:
 *   event_type  the specific interaction type
 *   route       the exact event route (no query string)
 *   method      the HTTP method
 *   session_ref a one-way reference to the session
 *   details     JSON containing safe metadata and userAgent
 *
 * What is NEVER stored:
 *   passwords, cookies, session IDs, tokens,
 *   Authorization headers, raw request bodies,
 *   query strings or IP addresses.
 */

const crypto = require('crypto');

const EVENT_TYPE = 'TRAP_ROUTE_ACCESSED';
const MAX_USER_AGENT_LENGTH = 200;

// Used only if SESSION_SECRET is not set.
const FALLBACK_KEY = crypto.randomBytes(32);

/**
 * Gets Student B's MySQL pool.
 */
function getPool() {
  const dbModule = require('./db');

  if (dbModule && typeof dbModule.execute === 'function') {
    return dbModule;
  }

  if (
    dbModule &&
    dbModule.pool &&
    typeof dbModule.pool.execute === 'function'
  ) {
    return dbModule.pool;
  }

  throw new Error(
    'db.js must export a mysql2 promise pool (or { pool }).'
  );
}

/**
 * Builds a non-secret reference to the visitor's session.
 */
function safeSessionRef(req) {
  const session = req.session;

  if (!session || !req.sessionID) {
    return 'no-session';
  }

  const hasData = Object.keys(session).some(
    (key) => key !== 'cookie'
  );

  if (!hasData) {
    return 'no-session';
  }

  const key = process.env.SESSION_SECRET || FALLBACK_KEY;

  const digest = crypto
    .createHmac('sha256', key)
    .update('trapdoor-session-ref:' + req.sessionID)
    .digest('hex');

  return 'sess_' + digest.slice(0, 12);
}

/**
 * Saves one security event.
 *
 * A custom eventType can be supplied through options.
 * If none is supplied, TRAP_ROUTE_ACCESSED is used.
 *
 * Sensitive values are never intentionally logged.
 */
async function logTrapAccess(req, options = {}) {
  const userAgent = String(
    req.get('user-agent') || 'unknown'
  ).slice(0, MAX_USER_AGENT_LENGTH);

  const eventType = options.eventType || EVENT_TYPE;

  const details = options.details
    ? { ...options.details, userAgent }
    : { userAgent };

  const sql =
    'INSERT INTO security_events ' +
    '(event_type, route, method, session_ref, details) ' +
    'VALUES (?, ?, ?, ?, ?)';

  const params = [
    eventType,
    (options.route || req.path).split('?')[0].slice(0, 255),
    (options.method || req.method).toUpperCase().slice(0, 10),
    safeSessionRef(req),
    JSON.stringify(details),
  ];

  try {
    await getPool().execute(sql, params);
  } catch (err) {
    console.error(
      '[eventLogger] Failed to write security event:',
      err.message
    );
  }
}

module.exports = {
  logTrapAccess,
  safeSessionRef,
};
