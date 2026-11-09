/**
 * routes.test.js — Student C
 *
 * Checks the trap routes: exact matching, allowed HTTP methods, decoy
 * content, pass-through of normal routes, and event recording.
 *
 * TWO KINDS OF TESTS (they never mix in one run):
 *
 *   [MOCKED]       `npm test`
 *       Builds a tiny Express app that mounts ONLY Student C's real
 *       trap.routes.js. The database is replaced by a jest.fn(), so no
 *       MySQL and no Student B code are needed. The one stub route
 *       (/api/portal) only proves that a normal path is not intercepted.
 *
 *   [INTEGRATION]  `npm run test:integration`
 *       Sends real HTTP requests to Student B's running backend
 *       (default http://localhost:5000, see INTEGRATION_BASE_URL) with
 *       real MySQL. Without RUN_INTEGRATION=true these tests are SKIPPED,
 *       never silently replaced by a fake.
 *
 * Integration environment variables (see .env.example):
 *   INTEGRATION_BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD,
 *   TEST_DEFENDER_EMAIL, TEST_DEFENDER_PASSWORD, TEST_CSRF_PATH (optional)
 */

const request = require('supertest');
const { TRAP_PATHS, getDecoyResponse } = require('../backend/src/trapData');

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeMocked = RUN_INTEGRATION ? describe.skip : describe;
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

// Replace Student B's db.js with a fake pool (mocked runs only).
// `virtual: true` lets this work even before Student B's db.js exists.
const mockExecute = jest.fn();
if (!RUN_INTEGRATION) {
  jest.doMock('../backend/src/db', () => ({ execute: (...args) => mockExecute(...args) }), {
    virtual: true,
  });
}

// Helpers ------------------------------------------------------------------

/** Mini app: session middleware + Student C's real router + one stub route. */
function buildMockApp() {
  const express = require('express');
  const session = require('express-session');
  const trapRouter = require('../backend/src/trap.routes');

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-only-secret', resave: false, saveUninitialized: false }));
  app.use(trapRouter);
  // Test stub standing in for Student B's portal. Not part of the product.
  app.get('/api/portal', (_req, res) => res.json({ items: [{ id: 1, title: 'stub real note' }] }));
  return app;
}

const insertCalls = () => mockExecute.mock.calls;

// ---------------------------------------------------------------------------
// [MOCKED] decoy responses
// ---------------------------------------------------------------------------
describeMocked('[MOCKED] Trap routes - decoy responses', () => {
  let app;
  beforeAll(() => {
    app = buildMockApp();
  });
  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  test.each(TRAP_PATHS)('GET %s returns 200 with the exact synthetic payload', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual(getDecoyResponse(path));
  });

  test('admin decoy only contains fake users on the .internal domain', async () => {
    const res = await request(app).get('/api/internal/admin');
    expect(res.body.adminUsers.length).toBeGreaterThan(0);
    res.body.adminUsers.forEach((u) => expect(u.email).toMatch(/@trapdoor\.internal$/));
  });

  test('backups decoy has the documented fields', async () => {
    const res = await request(app).get('/api/internal/backups');
    expect(res.body.backups.length).toBeGreaterThan(0);
    res.body.backups.forEach((b) => {
      ['filename', 'sizeBytes', 'createdAt', 'status'].forEach((f) => expect(b).toHaveProperty(f));
    });
  });

  test('config decoy never contains a real-looking secret', async () => {
    const res = await request(app).get('/api/internal/config');
    expect(res.body.session.secret).toBe('REDACTED');
  });

  test('HEAD is allowed: 200, no body, one event with method HEAD', async () => {
    const res = await request(app).head('/api/internal/admin');
    expect(res.status).toBe(200);
    expect(res.text || '').toBe('');
    expect(insertCalls()).toHaveLength(1);
    expect(insertCalls()[0][1][2]).toBe('HEAD');
  });

  test('a query string still matches and is NOT stored in the log', async () => {
    const res = await request(app).get('/api/internal/backups?token=abc123&x=1');
    expect(res.status).toBe(200);
    expect(insertCalls()).toHaveLength(1);
    expect(insertCalls()[0][1][1]).toBe('/api/internal/backups');
    expect(JSON.stringify(insertCalls()[0][1])).not.toMatch(/abc123/);
  });
});

// ---------------------------------------------------------------------------
// [MOCKED] HTTP method restrictions
// ---------------------------------------------------------------------------
describeMocked('[MOCKED] Trap routes - HTTP method restrictions', () => {
  let app;
  beforeAll(() => {
    app = buildMockApp();
  });
  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  const verbs = ['post', 'put', 'patch', 'delete'];

  TRAP_PATHS.forEach((path) => {
    test.each(verbs)(`${path}: %s -> 405, Allow header, no decoy data, one event`, async (verb) => {
      const res = await request(app)[verb](path).send({ anything: 'here' });
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe('GET, HEAD');
      expect(res.body).toEqual({ error: 'Method Not Allowed' });

      // The attempt is recorded once, with the real method.
      expect(insertCalls()).toHaveLength(1);
      expect(insertCalls()[0][1][1]).toBe(path);
      expect(insertCalls()[0][1][2]).toBe(verb.toUpperCase());
    });
  });

  test('the request body of a rejected POST is never logged', async () => {
    await request(app).post('/api/internal/admin').send({ password: 'hunter2-secret', token: 'tok-999' });
    const logged = JSON.stringify(insertCalls()[0]);
    expect(logged).not.toMatch(/hunter2-secret/);
    expect(logged).not.toMatch(/tok-999/);
  });
});

// ---------------------------------------------------------------------------
// [MOCKED] exact matching and pass-through
// ---------------------------------------------------------------------------
describeMocked('[MOCKED] Trap routes - exact matching and pass-through', () => {
  let app;
  beforeAll(() => {
    app = buildMockApp();
  });
  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  const notTraps = [
    '/api/internal/ADMIN', // different case
    '/api/internal/admin/', // trailing slash
    '/api/internal/admin/extra', // sub-path
    '/api/internal/admin.json', // extension
    '/api/internal', // parent path
    '/api/internal/', // parent path with slash
    '/api/internal/unknown', // not configured
    '/internal/admin', // missing /api prefix
  ];

  test.each(notTraps)('%s is NOT a trap: no decoy, no event, falls through to 404', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('adminUsers');
    expect(res.body).not.toHaveProperty('backups');
    expect(insertCalls()).toHaveLength(0);
  });

  test('a normal route passes through to its own handler and writes no event', async () => {
    const res = await request(app).get('/api/portal');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [{ id: 1, title: 'stub real note' }] });
    expect(insertCalls()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// [MOCKED] event recording
// ---------------------------------------------------------------------------
describeMocked('[MOCKED] Trap routes - event recording', () => {
  let app;
  beforeAll(() => {
    app = buildMockApp();
  });
  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  test('one trap request writes exactly one event with the agreed fields', async () => {
    await request(app).get('/api/internal/config').set('User-Agent', 'curl/8.4.0');
    expect(insertCalls()).toHaveLength(1);

    const [sql, params] = insertCalls()[0];
    expect(sql).toMatch(/^INSERT INTO security_events \(event_type, route, method, session_ref, details\)/);
    expect(params).toHaveLength(5);
    expect(params[0]).toBe('TRAP_ROUTE_ACCESSED');
    expect(params[1]).toBe('/api/internal/config');
    expect(params[2]).toBe('GET');
    expect(params[3]).toBe('no-session'); // anonymous visitor
    expect(JSON.parse(params[4])).toEqual({ userAgent: 'curl/8.4.0' });
  });

  test('if the database write fails, the decoy is still returned and no request data is printed', async () => {
    mockExecute.mockRejectedValue(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get('/api/internal/admin')
      .set('Authorization', 'Bearer top-secret-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(getDecoyResponse('/api/internal/admin'));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toMatch(/top-secret-token/);
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// [MOCKED] Student B compatibility: accepted shapes of db.js
// ---------------------------------------------------------------------------
describeMocked('[MOCKED] eventLogger - works with either db.js export shape', () => {
  const fakeReq = {
    path: '/api/internal/admin',
    method: 'GET',
    session: undefined,
    sessionID: undefined,
    get: () => 'test-agent',
  };

  // Load a fresh eventLogger whose db.js has the given export shape.
  function loadLoggerWithDb(dbExports) {
    jest.resetModules();
    jest.doMock('../backend/src/db', () => dbExports, { virtual: true });
    return require('../backend/src/eventLogger');
  }

  test('db.js exporting the pool directly (module.exports = pool)', async () => {
    const execute = jest.fn().mockResolvedValue([{}, undefined]);
    await loadLoggerWithDb({ execute }).logTrapAccess(fakeReq);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('a real mysql2 promise pool also has a callback-style `.pool`; that inner one must NOT be used', async () => {
    const execute = jest.fn().mockResolvedValue([{}, undefined]);
    const innerCallbackPool = { execute: jest.fn() }; // would crash if called without a callback
    await loadLoggerWithDb({ execute, pool: innerCallbackPool }).logTrapAccess(fakeReq);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(innerCallbackPool.execute).not.toHaveBeenCalled();
  });

  test('db.js exporting { pool } (module.exports = { pool })', async () => {
    const execute = jest.fn().mockResolvedValue([{}, undefined]);
    await loadLoggerWithDb({ pool: { execute } }).logTrapAccess(fakeReq);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('a wrong export shape is reported clearly and does not crash the request', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logger = loadLoggerWithDb({ notAPool: true });
    await expect(logger.logTrapAccess(fakeReq)).resolves.toBeUndefined();
    expect(errorSpy.mock.calls[0][1]).toMatch(/must export a mysql2 promise pool/);
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// [INTEGRATION] needs Student B's backend + MySQL running
// ---------------------------------------------------------------------------
describeIntegration('[INTEGRATION] Trap routes against the real backend', () => {
  const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:5000';

  /** Logs in and returns a cookie-keeping agent plus the CSRF header (if any). */
  async function login(email, password) {
    const agent = request.agent(BASE_URL);
    const headers = {};
    if (process.env.TEST_CSRF_PATH) {
      const csrf = await agent.get(process.env.TEST_CSRF_PATH);
      headers['x-csrf-token'] = csrf.body.csrfToken;
    }
    const res = await agent.post('/api/auth/login').set(headers).send({ email, password });
    if (res.status !== 200) throw new Error(`Login failed for ${email} (HTTP ${res.status})`);
    return { agent, headers };
  }

  const parseDetails = (d) => (typeof d === 'string' ? JSON.parse(d) : d || {});

  beforeAll(async () => {
    try {
      await request(BASE_URL).get('/api/auth/me');
    } catch {
      throw new Error(`Student B's backend is not reachable at ${BASE_URL}. Start it first.`);
    }
  });

  test.each(TRAP_PATHS)('GET %s returns exactly the synthetic payload from trapData.js', async (path) => {
    const res = await request(BASE_URL).get(path);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(getDecoyResponse(path));
  });

  test('POST to a trap path reaches the trap router (405, not a CSRF/auth error)', async () => {
    const res = await request(BASE_URL).post('/api/internal/admin').send({});
    expect(res.status).toBe(405);
  });

  test('trap paths with wrong case or trailing slash are not decoys', async () => {
    const upper = await request(BASE_URL).get('/api/internal/ADMIN');
    const slash = await request(BASE_URL).get('/api/internal/admin/');
    [upper, slash].forEach((res) => {
      expect(res.body).not.toHaveProperty('adminUsers');
      expect(res.status).not.toBe(200);
    });
  });

  test('a normal route is not intercepted: real portal requires login (401) and is not a decoy', async () => {
    const res = await request(BASE_URL).get('/api/portal');
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('adminUsers');
    expect(res.body).not.toHaveProperty('backups');
  });

  test('a logged-in user gets real portal data, not decoy data', async () => {
    const { agent } = await login(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);
    const res = await agent.get('/api/portal');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).not.toHaveProperty('adminUsers');
  });

  test('one trap request creates exactly one event, visible to the defender', async () => {
    const marker = `trapdoor-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await request(BASE_URL).get('/api/internal/backups').set('User-Agent', marker);

    const { agent } = await login(process.env.TEST_DEFENDER_EMAIL, process.env.TEST_DEFENDER_PASSWORD);
    const res = await agent.get('/api/defender/events');
    expect(res.status).toBe(200);

    const mine = res.body.events.filter((e) => parseDetails(e.details).userAgent === marker);
    expect(mine).toHaveLength(1);
    expect(mine[0].eventType).toBe('TRAP_ROUTE_ACCESSED');
    expect(mine[0].route).toBe('/api/internal/backups');
    expect(mine[0].method).toBe('GET');
  });
});
