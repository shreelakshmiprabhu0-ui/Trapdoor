/**
 * auth.test.js — Student C
 *
 * Authentication and authorization checks.
 *
 * Who owns what:
 *   - Login, sessions and the defender endpoint are STUDENT B's code. They
 *     can only be tested honestly against Student B's real backend, so those
 *     checks are [INTEGRATION] tests.
 *   - Trap routes are Student C's code. The [MOCKED] tests prove that they do
 *     not depend on, read from, or change a visitor's login state.
 *
 *   [MOCKED]       `npm test`                    no MySQL, no Student B code
 *   [INTEGRATION]  `npm run test:integration`    needs Student B's running
 *                                                backend + MySQL; otherwise
 *                                                these show as SKIPPED
 *
 * Integration environment variables: see the header of routes.test.js and
 * .env.example.
 */

const request = require('supertest');
const { getDecoyResponse } = require('../backend/src/trapData');

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeMocked = RUN_INTEGRATION ? describe.skip : describe;
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

const mockExecute = jest.fn();
if (!RUN_INTEGRATION) {
  jest.doMock('../backend/src/db', () => ({ execute: (...args) => mockExecute(...args) }), {
    virtual: true,
  });
}

// ---------------------------------------------------------------------------
// [MOCKED] trap routes and login state
// ---------------------------------------------------------------------------
describeMocked('[MOCKED] Trap routes do not depend on or change login state', () => {
  let app;

  beforeAll(() => {
    const express = require('express');
    const session = require('express-session');
    const trapRouter = require('../backend/src/trap.routes');

    app = express();
    app.use(express.json());
    app.use(session({ secret: 'test-only-secret', resave: false, saveUninitialized: false }));
    app.use(trapRouter);

    // TEST SCAFFOLDING (not Student B's auth): lets a test have a session
    // that looks like a logged-in user.
    app.get('/__test/login', (req, res) => {
      req.session.userId = 7;
      req.session.email = 'real-person@example.com';
      res.json({ ok: true });
    });
    app.get('/__test/whoami', (req, res) => res.json({ userId: req.session.userId || null }));
  });

  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  test('a visitor who is not logged in still gets the decoy (trap routes need no login)', async () => {
    const res = await request(app).get('/api/internal/admin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(getDecoyResponse('/api/internal/admin'));
  });

  test('a trap request from an anonymous visitor does not create a session or set a cookie', async () => {
    const res = await request(app).get('/api/internal/config');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('a logged-in visitor gets the same decoy as everyone else, with none of their own data', async () => {
    const agent = request.agent(app);
    await agent.get('/__test/login');

    const res = await agent.get('/api/internal/admin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(getDecoyResponse('/api/internal/admin'));
    expect(JSON.stringify(res.body)).not.toMatch(/real-person@example\.com/);
  });

  test('hitting a trap route does not change or end the visitor\'s login', async () => {
    const agent = request.agent(app);
    await agent.get('/__test/login');
    await agent.get('/api/internal/backups');
    await agent.post('/api/internal/backups').send({});

    const who = await agent.get('/__test/whoami');
    expect(who.body.userId).toBe(7);
  });

  test('Authorization and Cookie headers do not change the decoy response', async () => {
    const plain = await request(app).get('/api/internal/config');
    const withHeaders = await request(app)
      .get('/api/internal/config')
      .set('Authorization', 'Bearer some-token')
      .set('Cookie', 'connect.sid=s%3Afake.value');
    expect(withHeaders.status).toBe(200);
    expect(withHeaders.body).toEqual(plain.body);
  });
});

// ---------------------------------------------------------------------------
// [INTEGRATION] Student B's login and defender authorization
// ---------------------------------------------------------------------------
describeIntegration('[INTEGRATION] Login and defender authorization (Student B backend)', () => {
  const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:5000';

  /** Logs in and returns { agent, headers, res }; does not throw on a failed login. */
  async function login(email, password) {
    const agent = request.agent(BASE_URL);
    const headers = {};
    if (process.env.TEST_CSRF_PATH) {
      const csrf = await agent.get(process.env.TEST_CSRF_PATH);
      headers['x-csrf-token'] = csrf.body.csrfToken;
    }
    const res = await agent.post('/api/auth/login').set(headers).send({ email, password });
    return { agent, headers, res };
  }

  beforeAll(async () => {
    try {
      await request(BASE_URL).get('/api/auth/me');
    } catch {
      throw new Error(`Student B's backend is not reachable at ${BASE_URL}. Start it first.`);
    }
  });

  // --- Defender endpoint ---------------------------------------------------

  test('GET /api/defender/events -> 401 when not logged in', async () => {
    const res = await request(BASE_URL).get('/api/defender/events');
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('events');
  });

  test('GET /api/defender/events -> 403 for a normal USER, with no event data', async () => {
    const { agent, res: loginRes } = await login(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);
    expect(loginRes.status).toBe(200);

    const res = await agent.get('/api/defender/events');
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('events');
  });

  test('GET /api/defender/events -> 200 for a DEFENDER, with the agreed event shape', async () => {
    // Make sure there is at least one event to inspect.
    await request(BASE_URL).get('/api/internal/admin');

    const { agent, res: loginRes } = await login(
      process.env.TEST_DEFENDER_EMAIL,
      process.env.TEST_DEFENDER_PASSWORD
    );
    expect(loginRes.status).toBe(200);

    const res = await agent.get('/api/defender/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
    ['id', 'eventType', 'route', 'method', 'createdAt'].forEach((field) =>
      expect(res.body.events[0]).toHaveProperty(field)
    );
  });

  test('after logout the old session can no longer read events', async () => {
    const { agent, headers } = await login(process.env.TEST_DEFENDER_EMAIL, process.env.TEST_DEFENDER_PASSWORD);
    expect((await agent.get('/api/defender/events')).status).toBe(200);

    const logout = await agent.post('/api/auth/logout').set(headers);
    expect(logout.status).toBe(200);

    expect((await agent.get('/api/defender/events')).status).toBe(401);
  });

  // --- Login behaviour -----------------------------------------------------

  test('login with a wrong password -> 401 and no session user', async () => {
    const { agent, res } = await login(process.env.TEST_USER_EMAIL, 'definitely-the-wrong-password');
    expect(res.status).toBe(401);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  test('login with an unknown email -> 401', async () => {
    const { res } = await login('nobody-here@example.invalid', 'whatever-password');
    expect(res.status).toBe(401);
  });

  test('successful login never returns the password or a password hash', async () => {
    const { res } = await login(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/hash/i);
    expect(body).not.toContain(process.env.TEST_USER_PASSWORD);
    expect(body).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix
  });

  test('GET /api/auth/me -> 401 when not logged in', async () => {
    const res = await request(BASE_URL).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
