
// All network calls live here. Pages never call fetch directly.
// Switch between fake and real data with VITE_USE_MOCK in .env.

import { mockUsers, mockPortal, mockEvents } from './mockData.js';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

/* ---------- real API ---------- */

let csrfToken = null;
let csrfTokenPromise = null;

// Obtain a CSRF token for the current session.
// Concurrent requests share the same token-fetch operation.
async function getCsrfToken(forceRefresh = false) {
  if (forceRefresh) {
    csrfToken = null;
    csrfTokenPromise = null;
  }

  if (csrfToken) return csrfToken;

  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      const response = await fetch('/api/auth/csrf', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Could not obtain CSRF token.');
      }

      const body = await response.json();

      if (!body.csrfToken) {
        throw new Error('CSRF token missing from response.');
      }

      csrfToken = body.csrfToken;
      return csrfToken;
    })().finally(() => {
      csrfTokenPromise = null;
    });
  }

  return csrfTokenPromise;
}

async function readResponseBody(response) {
  try {
    return await response.json();
  } catch {
    // Empty response, such as logout.
    return null;
  }
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  async function sendRequest(forceRefresh = false) {
    const requestHeaders = { ...headers };

    if (needsCsrf) {
      requestHeaders['X-CSRF-Token'] =
        await getCsrfToken(forceRefresh);
    }

    return fetch(path, {
      ...options,
      credentials: 'include',
      headers: requestHeaders,
    });
  }

  let res;
  let body;

  try {
    res = await sendRequest();
    body = await readResponseBody(res);

    // If the session and token are out of sync,
    // fetch a fresh token and retry only once.
    if (
      needsCsrf &&
      res.status === 403 &&
      body?.error === 'CSRF_INVALID'
    ) {
      csrfToken = null;
      csrfTokenPromise = null;

      res = await sendRequest(true);
      body = await readResponseBody(res);
    }
  } catch {
    throw new ApiError(
      0,
      'Cannot reach the server or obtain a CSRF token.'
    );
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error || body?.message || `Request failed (${res.status})`
    );
  }

  // Successful login returns a fresh token after session regeneration.
  if (body?.csrfToken) {
    csrfToken = body.csrfToken;
    csrfTokenPromise = null;
  }

  return body;
}

const real = {
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: async () => {
    try {
      return await request('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      // The previous session has been destroyed.
      csrfToken = null;
      csrfTokenPromise = null;
    }
  },

  me: () => request('/api/auth/me'),

  getPortal: () => request('/api/portal'),

  getEvents: () => request('/api/defender/events'),

  getConfig: () => request('/api/internal/config'),

  createNote: (title, content) =>
    request('/api/portal/notes', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),

  updateNote: (id, title, content) =>
    request(`/api/portal/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content }),
    }),

  deleteNote: (id) =>
    request(`/api/portal/notes/${id}`, {
      method: 'DELETE',
    }),

  getBackups: () => request('/api/internal/backups'),

  adminDecoyLogin: (username, password) =>
    request('/api/internal/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};


/* ---------- mock API ---------- */

const SESSION_KEY = 'trapdoor-mock-user';

const getMockUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};

const mock = {
  async login(email, password) {
    await wait();

    const entry = mockUsers[email];

    if (!entry || entry.password !== password) {
      throw new ApiError(401, 'Email or password is incorrect.');
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry.user));

    return { user: entry.user };
  },

  async logout() {
    await wait(150);
    sessionStorage.removeItem(SESSION_KEY);
    return { ok: true };
  },

  async me() {
    await wait(150);

    const user = getMockUser();

    if (!user) {
      throw new ApiError(401, 'Not signed in.');
    }

    return { user };
  },

  async getPortal() {
    await wait();

    if (!getMockUser()) {
      throw new ApiError(401, 'Not signed in.');
    }

    return mockPortal;
  },

  async getEvents() {
    await wait();

    const user = getMockUser();

    if (!user) {
      throw new ApiError(401, 'Not signed in.');
    }

    if (user.role !== 'DEFENDER') {
      throw new ApiError(403, 'Only defenders can view events.');
    }

    return mockEvents;
  },

  async getConfig() {
    await wait(150);

    return {
      note: 'Application runtime configuration',

      app: {
        name: 'TRAPDOOR portal',
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
    };
  },

  async createNote(title, content) {
    await wait(150);

    const n = {
      id: Date.now(),
      title,
      body: content,
      createdAt: new Date().toISOString(),
    };

    mockPortal.items.unshift(n);

    return { note: n };
  },

  async updateNote(id, title, content) {
    await wait(150);

    const n = mockPortal.items.find(
      (x) => x.id === Number(id)
    );

    if (!n) {
      throw new ApiError(404, 'Note not found.');
    }

    Object.assign(n, {
      title,
      body: content,
    });

    return { note: n };
  },

  async deleteNote(id) {
    await wait(150);

    mockPortal.items = mockPortal.items.filter(
      (x) => x.id !== Number(id)
    );

    return { ok: true };
  },

  async getBackups() {
    await wait(150);

    return {
      backups: [
        {
          filename: 'db_full_20261101_020000.sql.gz',
          sizeBytes: 83886080,
          createdAt: '2026-11-01T02:00:00Z',
          status: 'completed',
        },
        {
          filename: 'db_full_20261031_020000.sql.gz',
          sizeBytes: 82837504,
          createdAt: '2026-10-31T02:00:00Z',
          status: 'completed',
        },
      ],
    };
  },

  async adminDecoyLogin(username, password) {
    await wait(250);

    const authenticated =
      username === 'demo_admin' &&
      password === 'TrapdoorDemo!2026';

    return {
      ok: true,
      authenticated,
      outcome: authenticated ? 'success' : 'failure',
    };
  },
};

export const api = USE_MOCK ? mock : real;
