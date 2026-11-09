# Backend setup and interfaces (Student B)

## Run everything
```bash
cp .env.example .env        # then edit every value (SESSION_SECRET, DB passwords)
docker compose up --build
curl http://localhost:4000/api/health      # {"status":"ok"}
docker compose exec backend npm test       # runs ../tests/*.test.js
```
To reset the database (re-runs schema.sql and seed.sql): `docker compose down -v`.

Demo accounts are provided in seed.sql for local development only.

## Auth + CSRF flow (for Student A)
All requests: `credentials: 'include'`. Every POST/PUT/PATCH/DELETE needs header `X-CSRF-Token`.
1. `GET /api/auth/csrf` -> `{ csrfToken }`
2. `POST /api/auth/login` with that header and `{ email, password }` -> `{ user, csrfToken }`
   (use the NEW csrfToken from the response for everything after login)
3. On page reload: `GET /api/auth/me` -> `{ user, csrfToken }` (401 if not logged in)
4. `POST /api/auth/logout` -> 204

Errors always look like `{ "error": "CODE", "message": "..." }`
(`UNAUTHENTICATED` 401, `FORBIDDEN` 403, `CSRF_INVALID` 403, `VALIDATION_ERROR` 400, `INVALID_CREDENTIALS` 401).

## Endpoints owned by Student B
| Method | Path | Auth | Response |
|---|---|---|---|
| GET | /api/health | none | `{status}` |
| GET | /api/auth/csrf | none | `{csrfToken}` |
| POST | /api/auth/login | none (+CSRF) | `{user, csrfToken}` |
| POST | /api/auth/logout | user | 204 |
| GET | /api/auth/me | user | `{user, csrfToken}` |
| GET | /api/portal | user | `{user, notes:[{id,title,content,createdAt}]}` |
| POST | /api/portal/notes | user (+CSRF) | 201 `{note}` body `{title, content}` |
| DELETE | /api/portal/notes/:id | user (+CSRF) | 204 |
| GET | /api/defender/events?limit&offset | DEFENDER | `{events:[{id,eventType,route,method,sessionRef,createdAt,details}], total}` |

(`POST`/`DELETE` notes are small additions to API_CONTRACT.md - add them there.)

## Interface for Student C
`app.js` mounts `./trap.routes` **before** CSRF and auth, so any visitor can hit a trap route.
- `trap.routes.js` must `module.exports = router` (an `express.Router`), handle only the exact allowlisted
  paths, and call `next()` for everything else.
- `app.js` sets `case sensitive routing` and `strict routing`, so `/api/internal/backups/` and
  `/API/internal/backups` do **not** match.
- Save an event with the single DB layer (do not create your own connection):
```js
const { saveSecurityEvent } = require('./db');
const { getSessionRef } = require('./auth');

await saveSecurityEvent({
  eventType: 'TRAP_ROUTE_ACCESSED',
  route: req.path,
  method: req.method,
  sessionRef: getSessionRef(req),
  details: { userAgent: req.get('user-agent') },   // small and safe only
});
```
`saveSecurityEvent` strips query strings, redacts keys like password/cookie/token/authorization,
and truncates oversized details. Trap handlers must NOT `require('./db')` for anything except
`saveSecurityEvent` and must never read from `users` or `notes`.
Use CommonJS (`require`) to match the rest of the backend.

Until Student C delivers, create a temporary placeholder `backend/src/trap.routes.js`:
```js
const router = require('express').Router();
module.exports = router;
```

## Security controls implemented
bcrypt password hashing (cost 12); parameterized SQL everywhere; server-side MySQL sessions with
HttpOnly + SameSite=Lax cookies (Secure via `COOKIE_SECURE=true`); session regeneration on login;
CSRF tokens; login rate limit (10 / 15 min); helmet headers; 10 kb JSON body limit; server-side
role checks; generic error messages; MySQL not published to the host.
