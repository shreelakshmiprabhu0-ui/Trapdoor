# TRAPDOOR — API Contract

This document records the agreed API shapes and the hand-over points between
students. Changes need agreement from all three students.

Ownership (from the implementation plan): Student B owns `app.js`, `db.js`,
`auth.js`, `portal.routes.js`, `defender.routes.js` and `database/`. Student C
owns `trap.routes.js`, `trapData.js`, `eventLogger.js` and `tests/`.

---

## Authentication — Student B

| Method | Path | Success | Failure |
|---|---|---|---|
| `POST` | `/api/auth/login` | `200 { "user": { "id", "name", "email", "role" } }` | `401 { "error": "Invalid credentials" }` |
| `POST` | `/api/auth/logout` | `200 { "ok": true }` | — |
| `GET` | `/api/auth/me` | `200 { "user": { ... } }` | `401 { "error": "Not authenticated" }` |

The login response must never contain the password or the password hash.

## Portal — Student B

`GET /api/portal` requires login. `200 { "items": [ { "id", "title", "body", "createdAt" } ] }`.
Not logged in: `401`.

## Defender — Student B

`GET /api/defender/events`

| Caller | Response |
|---|---|
| Not logged in | `401 { "error": "Not authenticated" }` |
| Logged in, role `USER` | `403 { "error": "Forbidden" }` |
| Role `DEFENDER` | `200 { "events": [ ... ] }` |

Student C's integration tests expect exactly **401 for no login and 403 for the
wrong role**. Role is checked on the server.

Event shape (database column → JSON field):

```json
{
  "events": [
    {
      "id": 14,
      "eventType": "TRAP_ROUTE_ACCESSED",
      "route": "/api/internal/backups",
      "method": "GET",
      "sessionRef": "sess_a91fc3d4e5b6",
      "createdAt": "2026-11-05T10:20:00Z",
      "details": { "userAgent": "curl/8.4.0" }
    }
  ]
}
```

`details` is stored as a JSON string and returned as an object. The endpoint
must return recent events, newest first (the tests look for the event they
just caused).

---

## Trap routes — Student C

| Path | Method | Response |
|---|---|---|
| `/api/internal/admin` | `GET`, `HEAD` | `200` synthetic JSON |
| `/api/internal/backups` | `GET`, `HEAD` | `200` synthetic JSON |
| `/api/internal/config` | `GET`, `HEAD` | `200` synthetic JSON |
| any of the three | `POST`, `PUT`, `PATCH`, `DELETE`, other | `405 { "error": "Method Not Allowed" }` with header `Allow: GET, HEAD` |

- Matching is **exact**: case-sensitive, no trailing slash, no sub-paths, no
  wildcards. `/api/internal/ADMIN`, `/api/internal/admin/` and
  `/api/internal/admin/x` are *not* trap routes and continue to Student B's
  normal routes (normally a 404). Query strings are ignored.
- Trap routes need no login. Their content comes only from `trapData.js`.
- Every request to a trap path, including a rejected `405`, writes exactly one
  `security_events` row (the method is stored, so probing with `POST` is visible).
- To add a trap route, add one entry to `TRAP_RESPONSES` in `trapData.js`.

---

## Hand-over: what Student B must provide

Student C's code relies on these. They are the **Student B dependencies**.

### 1. `backend/src/db.js` exports a mysql2 *promise* pool

```js
const mysql = require('mysql2/promise');
module.exports = mysql.createPool({ /* host, user, password, database ... */ });
// or: module.exports = { pool };
```

`eventLogger.js` calls `pool.execute(sql, params)` and does not open its own
connection. A callback-style pool (`require('mysql2')` without `/promise`) will
not work.

### 2. The `security_events` table (`database/schema.sql`)

```sql
CREATE TABLE security_events (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type  VARCHAR(64)  NOT NULL,
  route       VARCHAR(255) NOT NULL,
  method      VARCHAR(10)  NOT NULL,
  session_ref VARCHAR(32)  NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details     TEXT         NULL
);
```

The database user in `.env` needs `INSERT` on this table.

### 3. `app.js` mounts the trap router in the right place

```js
app.use(express.json());
app.use(session({ ... }));          // 1. session first (session_ref needs it)
app.use(require('./trap.routes'));  // 2. trap router
app.use(csrfProtection);            // 3. THEN CSRF, auth, portal, defender routes
```

If CSRF runs *before* the trap router, a `POST` to a trap path gets a CSRF `403`
instead of the trap's `405`, and the probe is not logged. Student C's
integration test "POST to a trap path reaches the trap router" checks this.

`session` should use `saveUninitialized: false`. Visitors without a real
session are then stored as `no-session`.

### 4. Session secret

`SESSION_SECRET` (already in `.env.example`) is used by `eventLogger.js` as the
key for the session reference. It is never stored or logged.

### 5. For the integration tests

- Demo accounts in `database/seed.sql`: one `USER`, one `DEFENDER`.
- If CSRF protection is on: a `GET` endpoint returning `{ "csrfToken": "..." }`
  (path goes in `TEST_CSRF_PATH`); the token is sent as the `x-csrf-token` header.
- The session cookie must work over plain `http://localhost` for the demo
  (cookie `secure` flag controlled by an environment setting, not hard-coded
  to `true` while `NODE_ENV=production` in Docker Compose).
- A `backend/Dockerfile` (referenced by `docker-compose.yml`).

---

## Event persistence interface (agreed)

Student C implements it; Student B supplies the pool.

```js
const { logTrapAccess } = require('./eventLogger');
await logTrapAccess(req); // never throws
```

Stored, and nothing else:

| Column | Value |
|---|---|
| `event_type` | `TRAP_ROUTE_ACCESSED` |
| `route` | `req.path` (exact trap path, no query string) |
| `method` | `req.method` |
| `session_ref` | `sess_` + 12 hex characters, or `no-session` |
| `details` | `{"userAgent": "..."}` cut to 200 characters |

**`session_ref`** is a keyed one-way hash (HMAC-SHA256, key `SESSION_SECRET`) of
the session ID. It lets a defender group events from one session, but it
contains no part of the session ID or cookie and cannot be reversed. (An earlier
version stored the first 8 characters of the session ID, which leaked secret
material.) A session counts only once something is stored in it (for example
after login); anonymous visitors get `no-session`.

Never stored: passwords, cookies, session IDs, tokens, `Authorization` headers,
request bodies, query strings, IP addresses.

---

## Shared-file changes made by Student C (for review by the owner)

| File | Owner | Change |
|---|---|---|
| `backend/package.json` | Student B | `connect-mysql2` `^1.0.3` → `^2.2.6` (1.x does not exist, so `npm install` failed); added devDependencies `cross-env`, `js-yaml`; added `test:integration` script; Jest `roots`/`testMatch`/`modulePaths` so Jest finds `../tests` |
| `docker-compose.yml` | B (db, backend), A (frontend), C (networks) | removed obsolete `version`; removed `db` host port; replaced single `app-network` with `public-net` + internal `db-net`; corrected isolation comments |
| `.env.example` | Student B | appended integration-test variables (nothing existing changed) |
| `docs/API_CONTRACT.md`, `docs/TEST_AND_DEMO.md` | shared | rewritten to match this implementation |

`app.js` is **not** edited by Student C. Student B adds the two lines in section 3.

---

## Database table note

Student B alone edits `database/schema.sql` and `seed.sql`. Student C asks for
changes through an issue or pull request.
