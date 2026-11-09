/**
 * trapData.js — Student C
 *
 * The list of trap routes and the synthetic (fabricated) response for each.
 *
 * Rules for this file:
 *   - Every value is invented. No real user data, secrets or credentials.
 *   - This file must NOT import db.js or read process.env. It is plain data.
 *   - TRAP_RESPONSES is the single source of truth: TRAP_PATHS is built from
 *     its keys, so the list of paths and the list of responses cannot drift
 *     apart.
 *
 * To add a trap route: add one entry to TRAP_RESPONSES. Nothing else changes.
 */

// ---------------------------------------------------------------------------
// Synthetic responses, keyed by the exact request path.
// ---------------------------------------------------------------------------
const TRAP_RESPONSES = {
  '/api/internal/admin': {
    note: 'Internal admin panel - do not expose externally',
    adminUsers: [
      {
        id: 1001,
        username: 'sysadmin',
        email: 'sysadmin@trapdoor.internal',
        lastLogin: '2026-10-31T08:14:22Z',
        role: 'SUPER_ADMIN',
      },
      {
        id: 1002,
        username: 'devops',
        email: 'devops@trapdoor.internal',
        lastLogin: '2026-11-01T14:55:00Z',
        role: 'ADMIN',
      },
    ],
    serverStats: {
      uptime: '14d 6h 22m',
      activeConnections: 42,
      environment: 'production',
    },
  },

  '/api/internal/backups': {
    note: 'Scheduled database backup listing',
    backups: [
      {
        filename: 'db_full_20261101_020000.sql.gz',
        sizeBytes: 83886080,
        createdAt: '2026-11-01T02:00:00Z',
        status: 'completed',
        sha256: 'a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
      },
      {
        filename: 'db_full_20261031_020000.sql.gz',
        sizeBytes: 82837504,
        createdAt: '2026-10-31T02:00:00Z',
        status: 'completed',
        sha256: 'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5',
      },
    ],
    storageLocation: 's3://trapdoor-backups-internal/daily/',
    retentionDays: 30,
  },

  '/api/internal/config': {
    note: 'Application runtime configuration',
    app: {
      name: 'TRAPDOOR Portal',
      version: '1.4.2',
      environment: 'production',
      debug: false,
    },
    database: {
      host: 'db.trapdoor.internal',
      port: 3306,
      name: 'trapdoor_prod',
      poolSize: 10,
    },
    session: {
      secret: 'REDACTED',
      maxAgeSecs: 3600,
      secure: true,
    },
    featureFlags: {
      maintenanceMode: false,
      newDashboard: true,
    },
  },
};

/** Exact paths treated as trap routes (built from the keys above). */
const TRAP_PATHS = Object.keys(TRAP_RESPONSES);

/**
 * Returns a fresh copy of the decoy body for an exact trap path,
 * or null if the path is not a trap route.
 *
 * A copy is returned so no caller can accidentally change the master data.
 * hasOwnProperty is used so names like "__proto__" or "constructor" can
 * never be mistaken for a trap path.
 *
 * @param {string} path  exact request path, e.g. '/api/internal/admin'
 * @returns {object|null}
 */
function getDecoyResponse(path) {
  if (!Object.prototype.hasOwnProperty.call(TRAP_RESPONSES, path)) {
    return null;
  }
  return JSON.parse(JSON.stringify(TRAP_RESPONSES[path]));
}

module.exports = { TRAP_PATHS, getDecoyResponse };
