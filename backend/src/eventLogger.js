/**
 * eventLogger.js — Student C
 *
 * Records trap-route access in the `security_events` table.
 *
 * Dependencies on Student B (see docs/API_CONTRACT.md):
 *   - ./db.js must export a mysql2 PROMISE pool (require('mysql2/promise')),
 *     either directly (module.exports = pool) or as { pool }.
 *   - The table `security_events` must exist (database/schema.sql).
 * This file never opens its own database connection.
 *
 * What is stored (and nothing else):
 *   event_type   always 'TRAP_ROUTE_ACCESSED'
 *   route        the exact trap path (no query string)
 *   method       the HTTP method
 *   session_ref  a one-way reference to the session (see safeSessionRef)
 *   details      JSON: userAgent plus explicitly supplied safe metadata
 *
 * What is NEVER stored: passwords, cookies, session IDs, tokens,
 * Authorization headers, raw request bodies, query strings or IP addresses.
 */

const crypto = require('crypto');

const EVENT_TYPE = 'TRAP_ROUTE_ACCESSED';
const MAX_USER_AGENT_LENGTH = 200;

// Used only if SESSION_SECRET is not set (e.g. in a quick local test).
// It is random per process, so references then change after a restart.
const FALLBACK_KEY = crypto.randomBytes(32);

/**
 * Gets Student B's MySQL pool. Looked up when needed (not at require time)
 * so a wrong export shape produces a clear message instead of a crash at
 * start-up.
 */
function getPool() {
  const dbModule = require('./db');

  // Check the export itself FIRST. A mysql2 promise pool also has a `.pool`
  // property, but that inner object is the old callback-style pool and must
  // not be used here.
  if (dbModule && typeof dbModule.execute === 'function') return dbModule;
  if (dbModule && dbModule.pool && typeof dbModule.pool.execute === 'function') return dbModule.pool;

  throw new Error('db.js must export a mysql2 promise pool (or { pool }).');
}

/**
 * Builds a non-secret reference to the visitor's session.
 *
 * Why not store part of the session ID? Even the first few characters of a
 * live session ID are secret material. Instead we store a keyed one-way hash
 * (HMAC-SHA256) of the ID, shortened to 12 hex characters. The same session
 * always gives the same reference, so a defender can group events, but the
 * reference cannot be turned back into the ID or the cookie.
 *
 * A request with no real session gets 'no-session'. A session counts as real
 * only if something has been stored in it (for example a user ID after
 * login). Otherwise express-session would invent a new random ID for every
 * anonymous request, and those references would be meaningless.
 *
 * @param {object} req  Express request
 * @returns {string}    at most 17 characters (fits VARCHAR(32))
 */
function safeSessionRef(req) {
  const session = req.session;
  if (!session || !req.sessionID) return 'no-session';

  const hasData = Object.keys(session).some((key) => key !== 'cookie');
  if (!hasData) return 'no-session';

  const key = process.env.SESSION_SECRET || FALLBACK_KEY;
  const digest = crypto
    .createHmac('sha256', key)
    .update('trapdoor-session-ref:' + req.sessionID)
    .digest('hex');
  return 'sess_' + digest.slice(0, 12);
}

/**
 * Saves one trap-access event.
 *
 * This function never throws. If the database write fails it reports a short
 * message to stderr (error text only, never request data), so the decoy
 * response is still returned to the caller.
 *
 * @param {object} req  Express request
 * @returns {Promise<void>}
 */
async function logTrapAccess(req, options = {}) {
  const userAgent = String(req.get('user-agent') || 'unknown').slice(0, MAX_USER_AGENT_LENGTH);

  // Parameterized SQL: values are passed separately and never joined into
  // the SQL text.
  const eventType = options.eventType || EVENT_TYPE;
  const details = options.details
    ? { ...options.details, userAgent }
    : { userAgent };
  const sql =
    'INSERT INTO security_events (event_type, route, method, session_ref, details) ' +
    'VALUES (?, ?, ?, ?, ?)';
  const params = [
    eventType,
    options.route || req.path,
    options.method || req.method,
    safeSessionRef(req),
    JSON.stringify(details),
  ];

  try {
    await getPool().execute(sql, params);
  } catch (err) {
    console.error('[eventLogger] Failed to write security event:', err.message);
  }
}

module.exports = { logTrapAccess, safeSessionRef };
