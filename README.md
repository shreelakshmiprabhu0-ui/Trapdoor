# TRAPDOOR
### Adaptive Web Application Deception System

TRAPDOOR is a web application deception system that detects and records access to deliberately planted trap routes. It responds to suspicious requests with synthetic decoy data and records the interactions for defenders to investigate.

## Project Overview

Traditional web applications expose resources and endpoints that may be discovered through reconnaissance. TRAPDOOR introduces deliberately configured deceptive endpoints that imitate sensitive application resources.

When a configured trap route is accessed:
1. The gateway matches the exact route.
2. A synthetic response is returned.
3. The access is recorded as a security event.
4. Defenders can inspect the event through the dashboard.

**Core workflow:**

Normal Portal → Trap Route Access → Synthetic Response → Event Logging → Defender Dashboard

## Features

- Normal user authentication and role-based access.
- Deliberately planted trap endpoints.
- Synthetic decoy responses.
- Security event logging in MySQL.
- Session-based event references.
- Defender dashboard for viewing trap activity.
- Docker Compose deployment.
- Database and frontend network separation.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Database | MySQL 8 |
| Authentication | Express Session, bcrypt |
| Security | Helmet, CSRF protection |
| Deployment | Docker, Docker Compose |

## Trap Endpoints

| Endpoint | Description |
|---|---|
| `/api/internal/admin` | Synthetic administrative information |
| `/api/internal/backups` | Synthetic backup listing |
| `/api/internal/config` | Synthetic configuration information |

These endpoints are deliberately configured traps. Their responses contain synthetic data, not actual application secrets or database records.

## Project Structure

```text
Trapdoor/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── db.js
│   │   ├── defender.routes.js
│   │   ├── eventLogger.js
│   │   ├── mysqlSessionStore.js
│   │   ├── portal.routes.js
│   │   ├── server.js
│   │   ├── trap.routes.js
│   │   └── trapData.js
│   ├── Dockerfile
│   └── package.json
├── database/
│   ├── schema.sql
│   └── seed.sql
├── docs/
│   ├── API_CONTRACT.md
│   └── TEST_AND_DEMO.md
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Docker Desktop
- Docker Compose
- Git

### Configuration

Create a root `.env` file with the following variables:

```env
DB_ROOT_PASSWORD=your_root_password
DB_NAME=trapdoor_db
DB_USER=trapdoor_user
DB_PASSWORD=your_database_password
SESSION_SECRET=your_long_random_session_secret
```

Use unique, strong values. Never commit `.env` to Git.

### Run with Docker Compose

Clone the repository:

```bash
git clone https://github.com/shreelakshmiprabhu0-ui/Trapdoor.git
cd Trapdoor
```

Configure the root `.env` file, then run:

```bash
docker compose up --build -d
```

Check the services:

```bash
docker compose ps
```

### Access the Application

| Service | Address |
|---|---|
| Frontend | http://localhost:5173 |
| Backend health | http://localhost:5000/api/health |

## Demo Accounts

The repository includes seeded local demonstration accounts:

| Role | Email |
|---|---|
| USER | `demo@trapdoor.local` |
| DEFENDER | `defender@trapdoor.local` |

Demo passwords are documented in `database/seed.sql`. These accounts are for local demonstrations only.

## Testing

From the backend directory:

```bash
npm install
npm test
```

For integration testing, see `docs/TEST_AND_DEMO.md`.

## Security Design and Limitations

- Trap routes return synthetic data.
- Trap matching uses explicit route definitions.
- Security events are stored separately from normal portal content.
- MySQL is not published as a host port.
- MySQL runs on an internal Docker network shared with the backend.
- The frontend does not have direct access to the database.
- Session references use HMAC-derived values rather than exposing raw session identifiers.

**Limitations:** TRAPDOOR is a deception and monitoring prototype. It does not prevent attacks, perform automated risk scoring, or guarantee isolation from vulnerabilities within the backend process.

## Documentation

- [API Contract](docs/API_CONTRACT.md)
- [Testing and Demo Guide](docs/TEST_AND_DEMO.md)

## Contributors

Add the project contributors and their respective responsibilities here.

## License

Add the selected project license here, if applicable.
