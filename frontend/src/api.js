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

async function request(path, options = {}) {
  let res;

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(options.method || 'GET')) {
      if (!csrfToken && path !== '/api/auth/csrf') {
        const csrfResponse = await fetch('/api/auth/csrf', {
          credentials: 'include',
        });

        if (!csrfResponse.ok) {
          throw new Error('Could not obtain CSRF token.');
        }

        const csrfBody = await csrfResponse.json();
        csrfToken = csrfBody.csrfToken;
      }

      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    res = await fetch(path, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server or obtain a CSRF token.');
  }

  let body = null;

  try {
    body = await res.json();
  } catch {
    // Empty response, such as logout.
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error || body?.message || `Request failed (${res.status})`
    );
  }

  // Login regenerates the session and returns a fresh CSRF token.
  if (body?.csrfToken) {
    csrfToken = body.csrfToken;
  }

  return body;
}

const real = {
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request('/api/auth/logout', { method: 'POST' }),

  me: () => request('/api/auth/me'),

  getPortal: () => request('/api/portal'),

  getEvents: () => request('/api/defender/events'),
};


/* ---------- mock API ---------- */

const SESSION_KEY = 'trapdoor-mock-user';
const getMockUser = () => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
};

const mock = {
  async login(email, password) {
    await wait();
    const entry = mockUsers[email];
    if (!entry || entry.password !== password) throw new ApiError(401, 'Email or password is incorrect.');
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
    if (!user) throw new ApiError(401, 'Not signed in.');
    return { user };
  },
  async getPortal() {
    await wait();
    if (!getMockUser()) throw new ApiError(401, 'Not signed in.');
    return mockPortal;
  },
  async getEvents() {
    await wait();
    const user = getMockUser();
    if (!user) throw new ApiError(401, 'Not signed in.');
    if (user.role !== 'DEFENDER') throw new ApiError(403, 'Only defenders can view events.');
    return mockEvents;
  },
};

export const api = USE_MOCK ? mock : real;
