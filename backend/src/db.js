// db.js - owns the ONE MySQL connection pool (Student B).
// Also provides the event-persistence interface used by Student C's eventLogger.js:
//   saveSecurityEvent({ eventType, route, method, sessionRef, details })
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

// Parameterized (server-side prepared) query helper. Never build SQL by string concatenation.
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ---------- event persistence ----------

const SENSITIVE_KEY = /pass(word)?|pwd|secret|token|cookie|authorization|auth|session|api[-_]?key|csrf|credential/i;
const EVENT_TYPE_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const MAX_DETAILS_CHARS = 2000;

// Defence in depth: even if a caller passes something sensitive, it is redacted / truncated here.
function sanitizeDetails(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (depth > 3) return '[truncated]';
  switch (typeof value) {
    case 'string': return value.slice(0, 200);
    case 'number':
    case 'boolean': return value;
    case 'object': {
      if (Array.isArray(value)) return value.slice(0, 10).map((v) => sanitizeDetails(v, depth + 1));
      const out = {};
      for (const [k, v] of Object.entries(value).slice(0, 20)) {
        const key = k.slice(0, 50);
        out[key] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : sanitizeDetails(v, depth + 1);
      }
      return out;
    }
    default: return String(value).slice(0, 200);
  }
}

/**
 * Persist one security event. Returns { id }.
 * @param {object} e
 * @param {string} e.eventType   e.g. 'TRAP_ROUTE_ACCESSED' (UPPER_SNAKE_CASE)
 * @param {string} e.route       request path (query string is stripped)
 * @param {string} e.method      HTTP method
 * @param {string} [e.sessionRef] non-secret reference from auth.getSessionRef(req)
 * @param {object} [e.details]   small, safe metadata (sanitised again here)
 */
async function saveSecurityEvent({ eventType, route, method, sessionRef = null, details = null }) {
  if (typeof eventType !== 'string' || !EVENT_TYPE_RE.test(eventType)) {
    throw new Error('saveSecurityEvent: invalid eventType');
  }
  if (typeof route !== 'string' || typeof method !== 'string') {
    throw new Error('saveSecurityEvent: route and method are required strings');
  }
  const cleanRoute = route.split('?')[0].slice(0, 255); // query strings may carry tokens
  const cleanMethod = method.toUpperCase().slice(0, 10);
  const cleanRef = sessionRef ? String(sessionRef).slice(0, 64) : null;

  let detailsJson = null;
  const cleanDetails = sanitizeDetails(details);
  if (cleanDetails !== null) {
    detailsJson = JSON.stringify(cleanDetails);
    if (detailsJson.length > MAX_DETAILS_CHARS) detailsJson = JSON.stringify({ truncated: true });
  }

  const [result] = await pool.execute(
    `INSERT INTO security_events (event_type, route, method, session_ref, details)
     VALUES (?, ?, ?, ?, ?)`,
    [eventType, cleanRoute, cleanMethod, cleanRef, detailsJson]
  );
  return { id: result.insertId };
}

/** Newest first. Used by defender.routes.js. */
async function listSecurityEvents({ limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  // LIMIT/OFFSET are validated integers, inlined because prepared LIMIT ? is unreliable in MySQL 8.
  const rows = await query(
    `SELECT id, event_type, route, method, session_ref, created_at, details
       FROM security_events ORDER BY id DESC LIMIT ${lim} OFFSET ${off}`
  );
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM security_events');
  return {
    total,
    events: rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      route: r.route,
      method: r.method,
      sessionRef: r.session_ref,
      createdAt: new Date(r.created_at).toISOString(),
      details: r.details ?? null,
    })),
  };
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, saveSecurityEvent, listSecurityEvents, sanitizeDetails, closePool };
