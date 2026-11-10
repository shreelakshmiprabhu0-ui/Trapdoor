
require('dotenv').config();

const app = require('./app');
const db = require('./db');

const port = Number(process.env.PORT) || 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await db.query('SELECT 1');
      console.log('Database connection established.');
      return;
    } catch (err) {
      console.error(
        `Database connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`
      );

      if (attempt === maxAttempts) {
        throw err;
      }

      await sleep(3000);
    }
  }
}

async function main() {
  await connectWithRetry();

  const server = app.listen(port, () => {
    console.log(`TRAPDOOR gateway listening on :${port}`);
  });

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
