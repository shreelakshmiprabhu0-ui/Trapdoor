
const session = require('express-session');

const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;

function getExpiry(sess) {
  const cookieExpiry = sess.cookie?.expires;

  if (cookieExpiry) {
    const timestamp = Math.floor(new Date(cookieExpiry).getTime() / 1000);

    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp;
    }
  }

  return Math.floor(Date.now() / 1000) + DEFAULT_SESSION_TTL_SECONDS;
}

class MySQLSessionStore extends session.Store {
  constructor({ pool, cleanupIntervalMs = 15 * 60 * 1000 }) {
    super();

    if (!pool || typeof pool.execute !== 'function') {
      throw new Error('A mysql2 promise pool is required.');
    }

    this.pool = pool;

    this.cleanupTimer = setInterval(() => {
      this.pool
        .execute('DELETE FROM sessions WHERE expires <= ?', [
          Math.floor(Date.now() / 1000),
        ])
        .catch((err) => {
          console.error('[session-store] Cleanup failed:', err.message);
        });
    }, cleanupIntervalMs);

    this.cleanupTimer.unref();
  }

  get(sid, callback) {
    this.pool
      .execute(
        'SELECT data, expires FROM sessions WHERE session_id = ?',
        [sid]
      )
      .then(([rows]) => {
        if (!rows.length) {
          return callback(null, null);
        }

        const row = rows[0];

        if (Number(row.expires) <= Math.floor(Date.now() / 1000)) {
          return this.destroy(sid, (err) => callback(err, null));
        }

        try {
          const data = JSON.parse(row.data);
          callback(null, data);
        } catch (err) {
          callback(err);
        }
      })
      .catch(callback);
  }

  set(sid, sess, callback = () => {}) {
    const expires = getExpiry(sess);

    this.pool
      .execute(
        `INSERT INTO sessions (session_id, expires, data)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           expires = VALUES(expires),
           data = VALUES(data)`,
        [sid, expires, JSON.stringify(sess)]
      )
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(sid, callback = () => {}) {
    this.pool
      .execute('DELETE FROM sessions WHERE session_id = ?', [sid])
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sid, sess, callback = () => {}) {
    const expires = getExpiry(sess);

    this.pool
      .execute(
        'UPDATE sessions SET expires = ? WHERE session_id = ?',
        [expires, sid]
      )
      .then(() => callback(null))
      .catch(callback);
  }

  close(callback = () => {}) {
    clearInterval(this.cleanupTimer);
    callback();
  }
}

module.exports = MySQLSessionStore;
