# TRAPDOOR — Revised Implementation Plan

**Project:** TRAPDOOR — Adaptive Web Application Deception System  
**Team:** 3 students  
**Timeline:** 4 weeks  
**Core stack:** React, JavaScript, Node.js, Express.js, MySQL  
**Supporting tools:** Git/GitHub, Docker Compose, Postman, automated tests

---

## 1. Project description

TRAPDOOR is a cybersecurity-focused web application that uses **deception routes** to observe suspicious exploration of a web application.

It consists of a small, legitimate portal and a separate decoy component. The legitimate portal provides normal features such as login, a user page and protected resources. Alongside these, TRAPDOOR contains deliberately planted routes that resemble interesting targets to someone exploring the application—for example, a fake internal admin resource, a fake backup listing or fabricated configuration information.

When a visitor accesses one of these configured trap routes, the gateway records the event and returns a carefully prepared synthetic response. The decoy content contains no real user information, secrets or production credentials. The defender can review recorded interactions through a protected view.

**Important design decision:** This version does not use numeric risk scoring or a multi-state session machine. There are no `NORMAL`, `SUSPECT` or `DECEIVED` states. A configured trap request is handled according to an explicit route rule. Other ordinary application requests continue through the normal application flow. This keeps the core mechanism understandable, testable and achievable in the available time.

The project demonstrates application-layer deception, controlled synthetic responses, secure full-stack development, event logging and separation of real application data from decoy content. It is a learning prototype, not a replacement for normal security controls.

### Example demonstration

1. A legitimate user logs in and uses the portal normally.
2. A tester visits a deliberately planted route such as `/api/internal/backups`.
3. The gateway recognises that exact route as a trap route.
4. It returns fabricated backup metadata rather than real application data.
5. TRAPDOOR records the route, time and interaction details that are safe to log.
6. The defender view displays the recorded event.
7. The team demonstrates that the fake response contains no real records and that the decoy component has no access to the real database.

---

## 2. Scope

### Build

- A small real portal with login and a few useful pages.
- Authentication, authorization and server-side sessions for normal application access.
- A small set of deliberately configured trap routes.
- A gateway that distinguishes normal application routes from configured trap routes.
- Synthetic responses for trap routes.
- Event logging for trap-route access and relevant decoy interactions.
- A protected defender page showing events and their details.
- A clear separation between real application data and decoy content.
- Input validation, parameterized SQL, password hashing, secure cookies and suitable security headers.
- Automated tests for normal routes, trap routes, authorization and data separation.

### Do not add

- Numeric risk scores, score thresholds or score decay.
- `NORMAL`, `SUSPECT` and `DECEIVED` session states.
- Automatic session-wide diversion.
- Machine learning, LLM APIs or blockchain.
- A large fake database or dozens of decoy pages.
- Unnecessary microservices or per-visitor containers.
- Real credentials, personal information or actual secrets in fake content.
- A public deployment that invites unknown people to attack the prototype.

If a feature does not improve the core trap-route deception flow, leave it out.

---

## 3. Technology stack

| Layer | Technology | Use |
|---|---|---|
| Frontend | React, HTML, CSS, JavaScript | Portal and defender interface |
| Backend | Node.js, Express.js | Routes, middleware and REST APIs |
| Database | MySQL | Real users, application data and event records |
| Isolation | Docker Compose | Run the application components with clear boundaries |
| Collaboration | Git and GitHub | Branches, pull requests and integration |
| Testing | Postman and automated tests | Verify APIs and expected behaviour |

Use the course's required technologies as the foundation. Avoid introducing Python, FastAPI, MongoDB, Firebase or external AI services.

Use server-side sessions for authentication. The browser must not be allowed to decide whether a request is a trap request. Trap-route matching must happen on the server using an explicit allowlist of configured paths.

---

## 4. Architecture

```text
                    Browser (React)
                          |
                          v
                  Express Gateway
                   /            \
          Normal route        Trap route
               |                   |
               v                   v
        Real app handlers     Decoy handlers
               |                   |
               v                   v
          Real MySQL       Synthetic decoy data
               |
               v
       Event records in MySQL
       (including trap access)
```

The Express gateway is the browser-facing backend. It routes ordinary application paths to the real application handlers and configured trap paths to decoy handlers. The decoy handler returns synthetic data only.

The decoy must not receive real database credentials. It must not be able to query or modify the real application database. For this project, decoy content can be held in small JavaScript data files rather than a second database; this reduces setup and maintenance while preserving the key separation requirement.

### Route handling

Keep a short, explicit list of trap paths, for example:

- `/api/internal/admin`
- `/api/internal/backups`
- `/api/internal/config`

These are examples; final paths should be chosen by the team. The gateway checks the requested path against the configured trap routes. A match invokes the corresponding decoy handler and writes an event. A non-match continues through the normal route chain.

Do not redirect the browser to another hostname. The browser should call the gateway, and the gateway should return the appropriate response.

---

## 5. Database design

Keep the database small.

### `users`

- `id` — primary key
- `name`
- `email` — unique
- `password_hash`
- `role` — for example `USER` or `DEFENDER`
- `created_at`

### Main application data

Choose one small data type for the portal, such as notes or resources. Do not build a large CRUD product merely to increase the number of features.

### `security_events`

- `id` — primary key
- `event_type` — for example `TRAP_ROUTE_ACCESSED`
- `route`
- `method`
- `session_ref` — non-secret reference, not the raw session cookie
- `created_at`
- `details` — optional, safe and limited metadata

Never log passwords, session cookies, authorization headers, full sensitive request bodies or real secrets. Keep fake decoy records in static synthetic data files unless there is a demonstrated need for a separate store.

**Schema ownership:** Student B owns the schema and database changes. Other students request changes through an issue or pull request rather than editing schema files independently.

---

## 6. Repository and file structure

This is a **lean target structure**. It deliberately combines small related responsibilities. Do not create every file before it is needed; add a file when it has a clear purpose.

```text
trapdoor/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── docs/
│   ├── PROJECT.md
│   ├── API_CONTRACT.md
│   └── TEST_AND_DEMO.md
│
├── frontend/                         # Student A
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Portal.jsx
│       │   └── Defender.jsx
│       ├── components/
│       │   ├── Navigation.jsx
│       │   └── EventList.jsx
│       ├── api.js
│       └── styles.css
│
├── backend/                           # Student B + Student C by file ownership
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── app.js
│       ├── db.js
│       ├── auth.js
│       ├── portal.routes.js
│       ├── defender.routes.js
│       ├── trap.routes.js             # Student C
│       ├── trapData.js                # Student C
│       └── eventLogger.js             # Student C; persistence contract agreed with B
│
├── database/                          # Student B
│   ├── schema.sql
│   └── seed.sql
│
└── tests/                             # Student C coordinates; all contribute
    ├── routes.test.js
    ├── auth.test.js
    └── isolation.test.js
```

### Why these files are grouped

- `auth.js` contains related authentication middleware and handlers rather than splitting each tiny helper into its own file.
- `portal.routes.js` groups the small set of normal portal endpoints.
- `defender.routes.js` groups the protected event-view endpoints.
- `trap.routes.js` contains the configured trap-route handlers.
- `trapData.js` contains the fabricated response data.
- `eventLogger.js` centralises safe event recording.
- `db.js` owns the MySQL connection pool.
- `app.js` wires middleware and routes together; `server.js` starts the server.

If one of these files grows substantially, split it later based on a real need. Do not split files just to make the folder tree look more professional.

---

## 7. Three-person work division

The aim is for each person to work independently in their own area for most of the project. Shared work is limited to agreeing on interfaces and integrating the finished parts.

### Student A — Frontend and visual design

**Owns:** `frontend/`

Responsibilities:

1. Set up React and the frontend project.
2. Design a consistent visual style: typography, spacing, colours, forms, buttons and responsive layout.
3. Build the login page.
4. Build the normal portal page and its small set of interactions.
5. Build the defender page to display recorded trap events.
6. Create reusable navigation and event-list components.
7. Connect the frontend to the agreed API paths.
8. Use mock JSON while the backend is being built.
9. Test loading, empty, error and unauthorized views.

**Does not own:** backend route logic, SQL schema, trap matching, event persistence or Docker configuration.

**Deliverables:** complete responsive frontend, mock data for development, API integration and screenshots.

### Student B — Core backend, authentication and database

**Owns:** `database/`, plus `backend/src/server.js`, `app.js`, `db.js`, `auth.js`, `portal.routes.js` and the database-related setup in `docker-compose.yml`.

Responsibilities:

1. Set up Node.js and Express.
2. Configure MySQL and create the schema and seed data.
3. Implement password hashing and login/logout.
4. Implement server-side session handling and role checks.
5. Implement the normal portal endpoints.
6. Implement protected defender endpoint shells that return event data through the agreed interface.
7. Use parameterized SQL queries.
8. Configure input validation, security headers and CSRF protection as appropriate.
9. Provide the event-persistence function/interface that Student C will call.
10. Write authentication and normal-route tests.

**Does not own:** React UI, trap-route matching rules or synthetic decoy content.

**Deliverables:** working core backend, authentication, database, normal APIs, event persistence interface and backend setup notes.

### Student C — Deception routes, synthetic data and security testing

**Owns:** `backend/src/trap.routes.js`, `trapData.js`, `eventLogger.js`, `tests/` and the decoy-related network configuration in `docker-compose.yml`.

Responsibilities:

1. Define the small set of deliberate trap routes with the team.
2. Implement server-side exact route matching and decoy responses.
3. Create realistic but clearly synthetic fake admin, backup and configuration data.
4. Record trap-route access through the event-persistence interface agreed with Student B.
5. Ensure the browser only talks to the gateway, never directly to an internal decoy service.
6. Help configure separation so decoy handling has no access to real application data.
7. Write tests proving that trap paths return fake data and ordinary paths still return normal data.
8. Test that unauthenticated users cannot access defender endpoints.
9. Test that logs do not contain passwords, cookies or other sensitive values.
10. Prepare the controlled demonstration sequence and document the deception mechanism.

**Does not own:** core authentication, normal portal APIs, SQL schema or React pages.

**Deliverables:** working trap routes, synthetic decoy content, event logging integration, security/integration tests and demo notes.

### Shared interface agreements

Before parallel implementation, agree on:

- Exact API paths and JSON response shapes.
- The list of trap routes.
- The event object fields.
- The function Student C calls to save an event using Student B's database layer.
- The frontend's expected defender-event response.

One person owns each shared file. Student B owns `app.js` and mounts Student C's trap routes. Student B owns the database schema and persistence implementation. Student C owns the trap handler and calls the agreed persistence interface. Student A consumes the documented API and does not edit backend files.

---

## 8. API contract

Agree on the endpoint names and response formats before parallel development.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Log in |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/auth/me` | Return current user |
| `GET` | `/api/portal` | Return normal portal data |
| `GET` | `/api/defender/events` | Return recorded trap events |
| `GET` | `/api/internal/admin` | Example trap route |
| `GET` | `/api/internal/backups` | Example trap route |
| `GET` | `/api/internal/config` | Example trap route |

The defender endpoint must check the user's role on the server. Do not rely on hiding the page in React as authorization.

Example event response:

```json
{
  "events": [
    {
      "id": 14,
      "eventType": "TRAP_ROUTE_ACCESSED",
      "route": "/api/internal/backups",
      "method": "GET",
      "createdAt": "2026-11-05T10:20:00Z"
    }
  ]
}
```

The exact route names and fields can be adjusted once, before implementation begins. After that, changes should be agreed by all three students.

---

## 9. Visual quality

A smaller project can still look polished. Focus on consistency rather than quantity:

- Give the real portal a clear visual identity.
- Make the defender page feel like a focused security investigation view, not a generic analytics dashboard.
- Present events with readable timestamps, route names and concise details.
- Use consistent spacing, typography, colours and component behaviour.
- Make the application responsive and provide useful empty, loading and error states.
- Keep decoy responses believable enough for the demonstration, but do not copy real services or include real secrets.

---

## 10. Four-week roadmap

| Week | Student A | Student B | Student C | Integration checkpoint |
|---|---|---|---|---|
| 1 | React setup, visual direction, page skeletons and mock data | Express setup, MySQL schema, auth and normal API skeleton | Define trap paths, response data and event format; create route-handler skeleton | Confirm API contract, file ownership and local setup |
| 2 | Complete login and portal UI; begin defender page | Complete auth, sessions, portal APIs and event persistence interface | Complete trap handlers, synthetic data and event recording integration | Frontend can call normal and trap APIs |
| 3 | Connect real APIs and finish defender event display | Finish authorization, database integration and security controls | Complete route tests, sensitive-log checks and data-separation tests | Full normal-route and trap-route flows work |
| 4 | Responsive polish, UI testing and screenshots | Fix backend issues, verify database and prepare setup instructions | Run integration tests, verify isolation and prepare demo | Freeze features, test clean setup and rehearse viva |

Do not wait until Week 4 to integrate. Merge small working pieces throughout the project.

---

## 11. GitHub workflow and conflict prevention

Use these branches:

- `main` — stable version for demonstration/submission.
- `integration` — combined working version.
- `frontend` — Student A's work.
- `backend-core` — Student B's work.
- `deception` — Student C's work.

Rules:

1. Each student works mainly in their owned folders/files.
2. Push small commits regularly.
3. Open pull requests into `integration`.
4. Do not edit another student's owned files without agreement.
5. Keep API contracts and shared data shapes in `docs/API_CONTRACT.md`.
6. Student B alone edits `database/schema.sql` and `seed.sql`.
7. Student B mounts the trap routes in `app.js`; Student C does not edit `app.js`.
8. Student C calls the event persistence function supplied by Student B; neither student duplicates the database connection.
9. Merge and test at least twice per week.
10. Merge `integration` into `main` only after the team verifies it.

---

## 12. Security and evaluation checklist

### Application security

- Passwords are hashed, never stored as plaintext.
- SQL queries use parameters.
- Inputs are validated on the server.
- Authentication and defender authorization are checked on the server.
- Session cookies use suitable `HttpOnly` and `SameSite` settings; use `Secure` when served over HTTPS.
- CSRF protection is used for state-changing requests where applicable.
- Security headers are configured.
- Logs do not contain passwords, cookies, tokens or sensitive request bodies.

### Deception correctness

- Only configured trap paths invoke decoy handlers.
- Ordinary portal routes continue to return real application responses.
- Trap routes return fabricated content only.
- Decoy content contains no real user data or secrets.
- The defender can see the recorded trap access.
- An ordinary user cannot access defender event data.
- The decoy handling path cannot query or modify the real database.

### Evaluation

Demonstrate and record:

- Normal route returns expected real application data.
- Trap route returns the expected synthetic response.
- Trap access creates exactly one appropriate event.
- Defender authorization is enforced.
- No sensitive values appear in event records.
- The application starts correctly from the documented setup steps.

---

## 13. Final demo sequence

1. Start the application using the documented Docker Compose command.
2. Open the React application.
3. Log in with the normal demo account.
4. Show that the ordinary portal works.
5. Open a configured trap route in a separate test session or API client.
6. Show that the gateway returns synthetic decoy data.
7. Open the defender page and show the recorded event.
8. Attempt to access the defender endpoint as a normal user and show that access is denied.
9. Explain how the decoy path is separated from real application data.
10. Show the relevant tests passing.

Use only your own local application and authorized test requests.

---

## 14. Viva explanation

**What is TRAPDOOR?**  
TRAPDOOR is a full-stack web application deception prototype. It uses deliberately configured trap routes to return synthetic resources and record suspicious exploration without exposing real application data.

**Is it a traditional honeypot?**  
It uses a web-application deception approach similar to a lightweight honeypot. Its focus is on planted application routes and synthetic responses.

**Does it prevent attacks?**  
It is not a replacement for prevention controls. It provides a controlled way to observe requests to selected trap resources while keeping fake content separate from real application data.

**Why no machine learning?**  
The project uses explicit route rules. They are transparent, explainable, easy to test and appropriate for the project timeline.

**How do you protect real data?**  
Trap handlers return fabricated data and do not use the real application's data-access functions. Database access and authorization are controlled on the server.

---

## Final scope rule

Build the smallest complete version first: **normal portal → configured trap route → synthetic response → event record → protected defender view**.

Once this flow works and is tested, improve the visual design, documentation and security checks. Do not add extra mechanisms just to increase the number of files or make the architecture appear more complex.
