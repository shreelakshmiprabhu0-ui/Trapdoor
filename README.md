# TRAPDOOR
### Adaptive Web Application Deception System

TRAPDOOR is a web application deception system designed to simulate sensitive application resources and record suspicious interactions. It provides controlled decoy interfaces, synthetic data, and a centralized security monitoring dashboard to help demonstrate how deception-based security mechanisms can detect and record unauthorized access attempts.

The project combines a conventional user portal with deliberately exposed synthetic resources, allowing security events to be captured and reviewed through a dedicated Defender dashboard.

---

## Features

### 1. User Portal
- User authentication and session management.
- Create, view, edit, and delete personal notes.
- Search and manage notes.
- User-specific data access and ownership checks.

### 2. Defender Dashboard
A centralized interface for monitoring recorded deception activity.

- View total security events.
- Monitor Admin, Backup, and Config activity.
- Chronological event history.
- Filter events by trap category.
- Search by route, event type, or session reference.
- Expand event records to inspect available details.

### 3. Deception Interfaces

TRAPDOOR provides three simulated interfaces representing sensitive application resources.

**Fake Admin Console**
- Simulated administrative login.
- Synthetic dashboard statistics.
- Simulated authentication outcomes.
- Records interactions for security monitoring.

**Backup Explorer**
- Displays synthetic backup records.
- Shows filenames, sizes, timestamps, and statuses.
- Provides simulated backup details.
- Does not access or download actual backup files.

**Configuration Console**
- Displays synthetic application configuration.
- Includes application, database, session, and feature-flag information.
- Sensitive configuration values are redacted.
- Read-only simulated interface.

### 4. Security Event Logging
- Records interactions with configured deception resources.
- Captures request metadata and event information.
- Uses session references instead of exposing raw session identifiers.
- Supports centralized event monitoring through the Defender dashboard.

---

## System Architecture

```text
                 TRAPDOOR
                     |
          +----------+----------+
          |                     |
     Normal Portal        Deception Routes
          |                     |
     Express Gateway     +------+------+
          |              |      |      |
     Authentication    Admin  Backup  Config
          |              |      |      |
     Portal Services     +------+------+
          |                     |
          |               Synthetic Data
          |                     |
          +----------+----------+
                     |
                Event Logger
                     |
              Security Events
                     |
             Defender Dashboard
```

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js |
| Build Tool | Vite |
| Backend | Node.js |
| Backend Framework | Express.js |
| Database | MySQL 8 |
| Containerization | Docker |
| Orchestration | Docker Compose |
| Authentication | Server-side sessions |
| Security | CSRF protection, role-based authorization, Helmet |

---

## Project Structure

```text
TRAPDOOR/
│
├── backend/
│   └── src/
│       ├── app.js
│       ├── auth.js
│       ├── db.js
│       ├── eventLogger.js
│       ├── portal.routes.js
│       ├── defender.routes.js
│       ├── trap.routes.js
│       └── mysqlSessionStore.js
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Portal.jsx
│       │   ├── Defender.jsx
│       │   ├── AdminTrap.jsx
│       │   ├── BackupExplorer.jsx
│       │   └── ConfigConsole.jsx
│       ├── AuthContext.jsx
│       ├── api.js
│       ├── App.jsx
│       └── styles.css
│
├── database/
│   └── seed.sql
│
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### Prerequisites

- Git
- Docker Desktop
- Docker Compose
- A modern web browser

### 1. Clone the repository

```bash
git clone https://github.com/shreelakshmiprabhu0-ui/Trapdoor.git
cd Trapdoor
```

### 2. Configure environment variables

Create a `.env` file in the project root and configure the variables required by `docker-compose.yml` and the backend.

Use secure, locally generated values for database credentials and the session secret. Do not commit `.env` files or secrets to GitHub.

### 3. Start the application

```bash
docker compose up --build -d
```

### 4. Access the application

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend health check | http://localhost:5000/api/health |
| User Portal | http://localhost:5173/portal |
| Defender Dashboard | http://localhost:5173/defender |
| Fake Admin | http://localhost:5173/internal/admin |
| Backup Explorer | http://localhost:5173/internal/backups |
| Config Console | http://localhost:5173/internal/config |

### 5. Check running containers

```bash
docker compose ps
```

### 6. Stop the application

```bash
docker compose down
```

---

## Authentication and Authorization

TRAPDOOR implements server-side session-based authentication.

- Passwords are verified using bcrypt.
- Sessions are stored using a MySQL-backed session store.
- CSRF protection is applied to state-changing API requests.
- Role-based authorization protects Defender endpoints.
- Normal users cannot access Defender-only event monitoring endpoints.

The application includes separate user and Defender roles.

---

## Security Considerations

TRAPDOOR is an academic demonstration of web application deception.

- Decoy resources use synthetic data only.
- No real administrative privileges are granted through the fake Admin Console.
- No actual backup files are accessed or downloaded.
- Sensitive configuration values are redacted.
- Raw session identifiers, cookies, passwords, and authentication tokens should not be included in security event logs.
- Defender access is enforced on the backend, not merely through frontend navigation.

**Important:** The deception interfaces are simulations and should not be treated as real administrative or infrastructure management systems.

---

## Future Scope

Potential future enhancements include:

- Expanded deception scenarios.
- More detailed security event analytics.
- Additional decoy resources.
- Improved event investigation and reporting.
- Extended testing and evaluation of deception effectiveness.

---

## Contributors

Developed as an academic Cyber Security project by students of **NMAM Institute of Technology (NMAMIT)**.

---

## License

This project is developed for academic and educational purposes.
