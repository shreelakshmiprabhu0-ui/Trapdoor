# TRAPDOOR — Testing and Demo Guide

**Author:** Student C

---

## 1. Two kinds of tests

All tests are in `tests/` and are run from the `backend/` folder.

| Kind | Command | Needs | What it proves |
|---|---|---|---|
| **MOCKED / STATIC** | `npm test` | nothing but `npm install` | Student C's own code: trap matching, HTTP methods, decoy content, safe logging, session reference, Docker network layout. The database is replaced by `jest.fn()`. |
| **INTEGRATION** | `npm run test:integration` | Student B's backend + MySQL running | The real system: real login, real defender authorization, real events in MySQL, real portal data kept out of decoys. |

Every test file contains both kinds in separate groups whose names start with
`[MOCKED]`, `[STATIC]` or `[INTEGRATION]`. A normal `npm test` shows the
integration tests as **skipped** (`○ skipped`). They are never replaced by a
fake app, so a green `npm test` does not claim anything about Student B's code.

| File | MOCKED / STATIC | INTEGRATION |
|---|---|---|
| `routes.test.js` | decoy payloads, exact matching, GET/HEAD vs 405, one event per request, logger failure, `db.js` export shapes | trap routes through the real gateway, 405 reaches the trap router (CSRF order), exactly one event visible to the defender |
| `auth.test.js` | trap routes need no login and never change login state | defender 401 / 403 / 200, logout, wrong password, no password/hash in login response |
| `isolation.test.js` | decoy code never imports `db.js`; only one `INSERT`; decoy data is synthetic; `docker-compose.yml` layout; `session_ref` leaks nothing; no secrets in log values; parameterized SQL | decoys contain none of a real user's data; the stored event contains no cookie/token/header/body |

---

## 2. Install and run

### Mocked / static tests (no database)

```bash
cd backend
npm install
npm test
```

### Integration tests (Student B's backend + MySQL must be running)

1. Start the application:

   ```bash
   cp .env.example .env      # fill in the DB_* and SESSION_SECRET values
   docker compose up --build
   ```

2. In another terminal, run the integration tests with the demo accounts from
   `database/seed.sql`:

   ```bash
   cd backend
   # macOS / Linux
   export INTEGRATION_BASE_URL=http://localhost:5000
   export TEST_USER_EMAIL='...'      TEST_USER_PASSWORD='...'
   export TEST_DEFENDER_EMAIL='...'  TEST_DEFENDER_PASSWORD='...'
   export TEST_CSRF_PATH='/api/auth/csrf'   # only if the backend uses CSRF tokens
   npm run test:integration
   ```

   ```powershell
   # Windows PowerShell
   cd backend
   $env:INTEGRATION_BASE_URL = 'http://localhost:5000'
   $env:TEST_USER_EMAIL = '...';     $env:TEST_USER_PASSWORD = '...'
   $env:TEST_DEFENDER_EMAIL = '...'; $env:TEST_DEFENDER_PASSWORD = '...'
   $env:TEST_CSRF_PATH = '/api/auth/csrf'   # only if the backend uses CSRF tokens
   npm run test:integration
   ```

   The tests do not read `.env` automatically; pass the values in your shell.
   Do not commit credentials. If the backend is not reachable the integration
   tests fail with a clear message ("Student B's backend is not reachable").

In an integration run, the `[MOCKED]` groups are skipped and the `[STATIC]`
groups still run.

---

## 3. Demo sequence (viva)

Use only your own local application and authorized test requests.

```bash
cp .env.example .env
docker compose up --build
```

### Step 1 — Normal portal works
Open `http://localhost:5173`, log in with the demo user from `database/seed.sql`.
The portal shows real notes from MySQL.

### Step 2 — Trap routes return synthetic data
```bash
curl -i http://localhost:5000/api/internal/backups
curl -i http://localhost:5000/api/internal/admin
curl -i http://localhost:5000/api/internal/config
```
Expected: `200` with fake backup names, fake admins on `@trapdoor.internal`, and a
fake config whose session secret reads `REDACTED`. Nothing comes from MySQL.

### Step 3 — Only the exact path and the right method are traps
```bash
curl -i -X POST http://localhost:5000/api/internal/admin   # 405, Allow: GET, HEAD
curl -i http://localhost:5000/api/internal/ADMIN           # not a trap: no decoy (normally 404)
curl -i http://localhost:5000/api/internal/admin/          # not a trap: no decoy (normally 404)
```

### Step 4 — The defender sees the events
Log in as the defender account and open the Defender page. Each request from
Step 2 shows as `TRAP_ROUTE_ACCESSED`; the `POST` from Step 3 shows with method
`POST`. The `session_ref` is `no-session` for curl, or `sess_` + 12 characters
for a logged-in browser.

### Step 5 — A normal user cannot read the events
```bash
curl -i http://localhost:5000/api/defender/events   # 401 (not logged in)
```
Logged in as the normal user the same request returns `403`.

### Step 6 — Show how the decoy is separated
```bash
# What each trap file imports (trapData.js imports nothing; db.js appears only in eventLogger.js):
grep -nE "^\s*(const|let|var) .*require\(" backend/src/trap.routes.js backend/src/trapData.js backend/src/eventLogger.js

# The only SQL the trap path can run:
grep -n "INSERT INTO" backend/src/eventLogger.js

# Network layout (project name defaults to the folder name; `docker network ls` shows it):
docker compose config                       # shows db-net as internal, db with no ports
docker network inspect <project>_db-net     # "Internal": true; only backend and db attached
```

### Step 7 — Run the tests
```bash
cd backend && npm test
```

---

## 4. Viva answers (accurate version)

**How does the gateway know which routes are traps?**
`trapData.js` holds one object keyed by exact path. `trap.routes.js` registers
one Express route per key, with `caseSensitive` and `strict` turned on, so only
the exact path matches. No regex, no wildcards. The browser cannot influence it.

**Why do POST/DELETE get a 405?**
The contract says trap routes are read-only resources. Other methods get `405`
with no decoy content, and the attempt is still logged.

**Is the decoy isolated from the real database?**
At two levels, with limits. *Code:* `trap.routes.js` and `trapData.js` never import
`db.js` or read environment variables, and the only database action on the trap
path is one parameterized `INSERT` in `eventLogger.js` (checked by tests).
*Network:* in Docker, MySQL is on an internal network that only the backend joins.
*Limit:* the trap handlers run inside the backend process, which holds the
database credentials, so this is separation by design of the code, not an
operating-system boundary. There is no separate decoy container. A stronger
option (not implemented, needs Student B) is a database user that can only
`INSERT` into `security_events` for the logger.

**What does `session_ref` contain?**
A shortened HMAC of the session ID using `SESSION_SECRET`. It groups events from
one session but cannot be reversed into any part of the session ID or cookie.

**How do you stop secrets reaching the logs?**
`eventLogger.js` reads only `req.path`, `req.method`, `req.get('user-agent')` and
a hash derived from the session. Cookies, `Authorization`, bodies and query strings
are never read. Tests send known secret strings and check none are stored.

**What if the log write fails?**
`logTrapAccess` catches its own errors and prints only the error message to
`stderr`; the decoy response is still returned.

**What does this NOT do?**
It does not stop attacks, does not score or classify visitors, and does not lock
the backend off from the internet. It records access to a few chosen paths.
