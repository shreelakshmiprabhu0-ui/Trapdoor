/**
 * isolation.test.js — Student C
 *
 * Proves the separation between decoy content and real data, and that event
 * records never contain sensitive values.
 *
 * Three groups:
 *
 *   [STATIC]       always runs; reads source files and docker-compose.yml.
 *                  Needs no database and no Student B code.
 *   [MOCKED]       `npm test`; database replaced by jest.fn().
 *   [INTEGRATION]  `npm run test:integration`; needs Student B's running
 *                  backend + MySQL. Otherwise shown as SKIPPED.
 *
 * What "isolation" means here (it is deliberately modest and honest):
 *   - The trap handlers run inside the backend process. There is no separate
 *     decoy container or decoy database.
 *   - trap.routes.js and trapData.js never import db.js or read env vars.
 *   - The only database action on the trap path is ONE parameterized INSERT
 *     into security_events (eventLogger.js).
 *   - In Docker, MySQL is on an internal network that only the backend joins.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const yaml = require('js-yaml');
const { TRAP_PATHS, getDecoyResponse } = require('../backend/src/trapData');

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeMocked = RUN_INTEGRATION ? describe.skip : describe;
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

const mockExecute = jest.fn();
if (!RUN_INTEGRATION) {
  jest.doMock('../backend/src/db', () => ({ execute: (...args) => mockExecute(...args) }), {
    virtual: true,
  });
}

// Helpers ------------------------------------------------------------------

const ROOT = path.join(__dirname, '..');
const readFile = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

/** Source code with /* block *\/ and // line comments removed. */
function codeOnly(relativePath) {
  return readFile(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/.*$/gm, '');
}

/** Every module name passed to require('...') in a file. */
function requiredModules(relativePath) {
  const found = [];
  const pattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const code = codeOnly(relativePath);
  let match;
  while ((match = pattern.exec(code)) !== null) found.push(match[1]);
  return found;
}

// ---------------------------------------------------------------------------
// [STATIC] code-level isolation
// ---------------------------------------------------------------------------
describe('[STATIC] Decoy code never touches the real database', () => {
  test('trapData.js imports nothing and reads no environment variables', () => {
    expect(requiredModules('backend/src/trapData.js')).toEqual([]);
    expect(codeOnly('backend/src/trapData.js')).not.toMatch(/process\.env/);
  });

  test('trap.routes.js imports only express, trapData and eventLogger (never db.js)', () => {
    expect(requiredModules('backend/src/trap.routes.js').sort()).toEqual(
      ['./eventLogger', './trapData', 'express'].sort()
    );
    expect(codeOnly('backend/src/trap.routes.js')).not.toMatch(/process\.env/);
  });

  test('eventLogger.js only imports crypto and db.js', () => {
    expect(requiredModules('backend/src/eventLogger.js').sort()).toEqual(['./db', 'crypto']);
  });

  test('eventLogger.js contains only INSERT SQL (no SELECT/UPDATE/DELETE/DROP/ALTER/TRUNCATE)', () => {
    const code = codeOnly('backend/src/eventLogger.js');
    expect(code).toMatch(/INSERT INTO security_events/);
    expect(code).not.toMatch(/\b(SELECT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT)\b/);
  });

  test('every trap path has a decoy, and unlisted paths do not (incl. object-prototype names)', () => {
    TRAP_PATHS.forEach((p) => expect(getDecoyResponse(p)).not.toBeNull());
    ['/api/portal', '/api/auth/login', '/api/internal/unknown', '__proto__', 'constructor', 'toString'].forEach(
      (p) => expect(getDecoyResponse(p)).toBeNull()
    );
  });

  test('getDecoyResponse returns a copy, so callers cannot change the master data', () => {
    const first = getDecoyResponse('/api/internal/admin');
    first.adminUsers.length = 0;
    expect(getDecoyResponse('/api/internal/admin').adminUsers.length).toBeGreaterThan(0);
  });
});

describe('[STATIC] Decoy content is clearly synthetic', () => {
  const allDecoys = TRAP_PATHS.map((p) => getDecoyResponse(p));

  test('no environment value can appear in decoy data', () => {
    const sentinel = 'SENTINEL-ENV-VALUE-12345';
    process.env.DB_PASSWORD = sentinel;
    process.env.SESSION_SECRET = sentinel;
    expect(JSON.stringify(allDecoys)).not.toContain(sentinel);
    delete process.env.DB_PASSWORD;
    delete process.env.SESSION_SECRET;
  });

  test('every email is on the fake .internal domain and every host ends in .internal', () => {
    const text = JSON.stringify(allDecoys);
    (text.match(/[\w.+-]+@[\w.-]+/g) || []).forEach((email) => expect(email).toMatch(/@trapdoor\.internal$/));
    (text.match(/"host":"[^"]+"/g) || []).forEach((h) => expect(h).toMatch(/\.internal"$/));
  });

  test('no keys named password/token/apikey and no real-looking secret formats', () => {
    const text = JSON.stringify(allDecoys);
    expect(text).not.toMatch(/"(password|passwd|token|apikey|api_key|accesskey)"\s*:/i);
    expect(text).not.toMatch(/AKIA[0-9A-Z]{16}/); // AWS access key id
    expect(text).not.toMatch(/-----BEGIN/); // private keys
    expect(text).not.toMatch(/\$2[aby]\$/); // bcrypt hashes
  });
});

describe('[STATIC] docker-compose.yml isolation matches what the comments claim', () => {
  const compose = yaml.load(readFile('docker-compose.yml'));
  const networksOf = (service) => {
    const n = compose.services[service].networks || [];
    return Array.isArray(n) ? n : Object.keys(n);
  };

  test('there is no separate decoy/honeypot service', () => {
    expect(Object.keys(compose.services).sort()).toEqual(['backend', 'db', 'frontend']);
  });

  test('MySQL publishes no host port', () => {
    expect(compose.services.db.ports).toBeUndefined();
  });

  test('MySQL is attached only to an internal network', () => {
    expect(networksOf('db')).toEqual(['db-net']);
    expect(compose.networks['db-net'].internal).toBe(true);
  });

  test('only the backend can reach MySQL (frontend is not on db-net)', () => {
    expect(networksOf('backend')).toContain('db-net');
    expect(networksOf('frontend')).not.toContain('db-net');
    const attached = Object.keys(compose.services).filter((s) => networksOf(s).includes('db-net'));
    expect(attached.sort()).toEqual(['backend', 'db']);
  });

  test('the frontend container receives no database or session secrets', () => {
    const env = JSON.stringify(compose.services.frontend.environment || {});
    expect(env).not.toMatch(/DB_|SESSION_SECRET/);
  });

  test('every network a service uses is actually defined (so hostnames resolve)', () => {
    Object.keys(compose.services).forEach((s) =>
      networksOf(s).forEach((n) => expect(compose.networks).toHaveProperty([n]))
    );
  });

  test('the file does not claim the backend is cut off from the internet', () => {
    expect(readFile('docker-compose.yml')).not.toMatch(/cannot reach the internet|can only reach the db/i);
  });
});

// ---------------------------------------------------------------------------
// [MOCKED] runtime behaviour of the trap path
// ---------------------------------------------------------------------------
describeMocked('[MOCKED] Trap traffic only ever INSERTs one event row', () => {
  const SESSION_SECRET = 'sentinel-session-secret-do-not-log';
  let app;

  beforeAll(() => {
    process.env.SESSION_SECRET = SESSION_SECRET;
    const express = require('express');
    const session = require('express-session');
    const trapRouter = require('../backend/src/trap.routes');

    app = express();
    app.use(express.json());
    app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
    app.use(trapRouter);

    // TEST SCAFFOLDING: gives a test a real session (and its ID to compare against).
    app.get('/__test/login', (req, res) => {
      req.session.userId = 7;
      res.json({ sessionId: req.sessionID });
    });
  });

  afterAll(() => {
    delete process.env.SESSION_SECRET;
  });

  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  test('across every trap path and method, each database call is the same single INSERT', async () => {
    for (const trapPath of TRAP_PATHS) {
      for (const verb of ['get', 'head', 'post', 'put', 'patch', 'delete']) {
        await request(app)[verb](trapPath);
      }
    }
    const calls = mockExecute.mock.calls;
    expect(calls).toHaveLength(TRAP_PATHS.length * 6);
    calls.forEach(([sql]) => {
      expect(sql).toMatch(/^INSERT INTO security_events \(event_type, route, method, session_ref, details\) VALUES \(\?, \?, \?, \?, \?\)$/);
    });
  });

  // --- session_ref ---------------------------------------------------------

  describe('session_ref never exposes the session ID or cookie', () => {
    async function trapHitWithSession() {
      const agent = request.agent(app);
      const login = await agent.get('/__test/login');
      const cookie = login.headers['set-cookie'][0];
      mockExecute.mockClear();
      await agent.get('/api/internal/admin');
      const params = mockExecute.mock.calls[0][1];
      return { sessionId: login.body.sessionId, cookie, ref: params[3], params };
    }

    test('format is sess_ + 12 hex characters and fits the VARCHAR(32) column', async () => {
      const { ref } = await trapHitWithSession();
      expect(ref).toMatch(/^sess_[0-9a-f]{12}$/);
      expect(ref.length).toBeLessThanOrEqual(32);
    });

    test('contains no piece of the session ID (the original bug stored its first 8 characters)', async () => {
      const { sessionId, ref } = await trapHitWithSession();
      expect(ref).not.toContain(sessionId.slice(0, 8));
      for (let i = 0; i + 8 <= sessionId.length; i++) {
        expect(ref).not.toContain(sessionId.slice(i, i + 8));
      }
    });

    test('the full cookie and the session secret appear nowhere in the stored values', async () => {
      const { sessionId, cookie, params } = await trapHitWithSession();
      const stored = JSON.stringify(params);
      expect(stored).not.toContain(sessionId);
      expect(stored).not.toContain(encodeURIComponent(sessionId));
      expect(stored).not.toContain(cookie.split(';')[0].split('=')[1]);
      expect(stored).not.toContain(SESSION_SECRET);
    });

    test('the same session always gets the same reference; a different session gets a different one', async () => {
      const agent = request.agent(app);
      await agent.get('/__test/login');
      mockExecute.mockClear();
      await agent.get('/api/internal/admin');
      await agent.get('/api/internal/config');
      const [first, second] = mockExecute.mock.calls.map((c) => c[1][3]);
      expect(first).toBe(second);

      const other = await trapHitWithSession();
      expect(other.ref).not.toBe(first);
    });

    test('anonymous visitors (no real session) are recorded as no-session', async () => {
      await request(app).get('/api/internal/admin');
      await request(app).get('/api/internal/admin');
      const refs = mockExecute.mock.calls.map((c) => c[1][3]);
      expect(refs).toEqual(['no-session', 'no-session']);
    });

    test('the reference depends on the secret key (a different key gives a different value)', async () => {
      const { safeSessionRef } = require('../backend/src/eventLogger');
      const fakeReq = { session: { cookie: {}, userId: 1 }, sessionID: 'abc123-same-session-id' };
      const withKeyA = safeSessionRef(fakeReq);
      process.env.SESSION_SECRET = 'a-completely-different-secret';
      const withKeyB = safeSessionRef(fakeReq);
      process.env.SESSION_SECRET = SESSION_SECRET;
      expect(withKeyA).not.toBe(withKeyB);
    });
  });

  // --- no sensitive values in the log --------------------------------------

  describe('no sensitive request values are stored', () => {
    test('cookies, Authorization, API keys, request body and query string are never logged', async () => {
      const agent = request.agent(app);
      await agent.get('/__test/login');
      mockExecute.mockClear();

      await agent
        .post('/api/internal/admin?apikey=query-secret-777')
        .set('Authorization', 'Bearer bearer-secret-111')
        .set('x-api-key', 'apikey-secret-222')
        .set('x-csrf-token', 'csrf-secret-333')
        .send({ password: 'body-password-444', token: 'body-token-555' });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const stored = JSON.stringify(mockExecute.mock.calls[0]);
      [
        'bearer-secret-111',
        'apikey-secret-222',
        'csrf-secret-333',
        'query-secret-777',
        'body-password-444',
        'body-token-555',
      ].forEach((secret) => expect(stored).not.toContain(secret));
      expect(stored.toLowerCase()).not.toMatch(/password|cookie|authorization|connect\.sid/);
    });

    test('details contains only the user agent, cut to 200 characters', async () => {
      await request(app).get('/api/internal/config').set('User-Agent', 'A'.repeat(500));
      const details = JSON.parse(mockExecute.mock.calls[0][1][4]);
      expect(Object.keys(details)).toEqual(['userAgent']);
      expect(details.userAgent).toHaveLength(200);
    });

    test('SQL is parameterized: hostile input appears only in the parameters, never in the SQL text', async () => {
      const hostile = "x'); DROP TABLE security_events; --";
      await request(app).get('/api/internal/backups').set('User-Agent', hostile);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).not.toContain('DROP');
      expect(sql).not.toContain(hostile);
      expect(sql.match(/\?/g)).toHaveLength(5);
      expect(JSON.parse(params[4]).userAgent).toBe(hostile); // stored as plain data
    });
  });
});

// ---------------------------------------------------------------------------
// [INTEGRATION] real backend + MySQL
// ---------------------------------------------------------------------------
describeIntegration('[INTEGRATION] Isolation and safe logging against the real backend', () => {
  const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:5000';

  // Returns the agent plus every cookie VALUE the server issued during login
  // (the secrets that must never appear in an event record).
  async function login(email, password) {
    const agent = request.agent(BASE_URL);
    const headers = {};
    const cookieValues = [];
    const collect = (res) =>
      (res.headers['set-cookie'] || []).forEach((c) => cookieValues.push(c.split(';')[0].split('=')[1]));

    if (process.env.TEST_CSRF_PATH) {
      const csrf = await agent.get(process.env.TEST_CSRF_PATH);
      collect(csrf);
      headers['x-csrf-token'] = csrf.body.csrfToken;
    }
    const res = await agent.post('/api/auth/login').set(headers).send({ email, password });
    collect(res);
    if (res.status !== 200) throw new Error(`Login failed for ${email} (HTTP ${res.status})`);
    return { agent, headers, res, cookieValues };
  }

  const parseDetails = (d) => (typeof d === 'string' ? JSON.parse(d) : d || {});

  beforeAll(async () => {
    try {
      await request(BASE_URL).get('/api/auth/me');
    } catch {
      throw new Error(`Student B's backend is not reachable at ${BASE_URL}. Start it first.`);
    }
  });

  test('decoy responses contain none of the real user\'s data', async () => {
    const { agent } = await login(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);
    const portal = await agent.get('/api/portal');
    expect(portal.status).toBe(200);

    // Collect real strings the decoys must never contain.
    const realValues = [process.env.TEST_USER_EMAIL];
    (portal.body.items || []).forEach((item) => {
      Object.values(item).forEach((v) => {
        if (typeof v === 'string' && v.length >= 4) realValues.push(v);
      });
    });

    for (const trapPath of TRAP_PATHS) {
      const res = await agent.get(trapPath); // even a logged-in real user gets only decoy data
      expect(res.body).toEqual(getDecoyResponse(trapPath));
      const text = JSON.stringify(res.body);
      realValues.forEach((value) => expect(text).not.toContain(value));
    }
  });

  test('the stored event contains no cookies, tokens, headers, body or session ID', async () => {
    const marker = `trapdoor-iso-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const user = await login(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);

    // Real session cookie values issued during login (must never reach the log).
    const { cookieValues } = user;
    expect(cookieValues.length).toBeGreaterThan(0);

    await user.agent
      .post('/api/internal/config?apikey=query-secret-777')
      .set('User-Agent', marker)
      .set('Authorization', 'Bearer bearer-secret-111')
      .set('x-api-key', 'apikey-secret-222')
      .send({ password: 'body-password-444' });

    const defender = await login(process.env.TEST_DEFENDER_EMAIL, process.env.TEST_DEFENDER_PASSWORD);
    const res = await defender.agent.get('/api/defender/events');
    expect(res.status).toBe(200);

    const mine = res.body.events.filter((e) => parseDetails(e.details).userAgent === marker);
    expect(mine).toHaveLength(1);

    const stored = JSON.stringify(mine[0]);
    ['bearer-secret-111', 'apikey-secret-222', 'query-secret-777', 'body-password-444'].forEach((secret) =>
      expect(stored).not.toContain(secret)
    );
    cookieValues.forEach((value) => {
      expect(stored).not.toContain(value);
      expect(stored).not.toContain(decodeURIComponent(value));
    });
    expect(stored).not.toContain(process.env.TEST_USER_PASSWORD);

    expect(mine[0].method).toBe('POST');
    expect(mine[0].sessionRef).toMatch(/^(sess_[0-9a-f]{12}|no-session)$/);
    expect(Object.keys(parseDetails(mine[0].details))).toEqual(['userAgent']);
  });
});
