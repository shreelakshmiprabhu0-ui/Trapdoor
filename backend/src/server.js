// server.js - starts the HTTP server (Student B).
require('dotenv').config();
const app = require('./app');
const db = require('./db');

const port = Number(process.env.PORT) || 4000;

async function main() {
  await db.query('SELECT 1'); // fail fast if MySQL is unreachable
  const server = app.listen(port, () => console.log(`TRAPDOOR gateway listening on :${port}`));

  const shutdown = () => {
    server.close(async () => {
      await app.closeStore();
      await db.closePool();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
