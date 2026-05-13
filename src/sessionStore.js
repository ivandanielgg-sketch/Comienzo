function createSqliteSessionStore(session, database, { ttlMs }) {
  const Store = session.Store;

  return new (class SqliteSessionStore extends Store {
    constructor() {
      super();
      this.getStmt = database.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
      this.setStmt = database.prepare(
        `INSERT INTO sessions (sid, sess, expires)
         VALUES (@sid, @sess, @expires)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`,
      );
      this.destroyStmt = database.prepare('DELETE FROM sessions WHERE sid = ?');
      this.touchStmt = database.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
      this.cleanupStmt = database.prepare('DELETE FROM sessions WHERE expires <= ?');
      this.cleanupExpired();
    }

    get(sid, callback) {
      try {
        const row = this.getStmt.get(sid);
        if (!row) {
          return callback(null, null);
        }

        if (row.expires <= Date.now()) {
          this.destroyStmt.run(sid);
          return callback(null, null);
        }

        const sessionData = JSON.parse(row.sess);
        if (sessionData.cookie?.expires) {
          sessionData.cookie.expires = new Date(sessionData.cookie.expires);
        }

        return callback(null, sessionData);
      } catch (error) {
        return callback(error);
      }
    }

    set(sid, sessionData, callback = () => {}) {
      try {
        this.cleanupExpired();
        this.setStmt.run({
          sid,
          sess: JSON.stringify(sessionData),
          expires: this.getExpiration(sessionData),
        });
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    }

    destroy(sid, callback = () => {}) {
      try {
        this.destroyStmt.run(sid);
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    }

    touch(sid, sessionData, callback = () => {}) {
      try {
        this.touchStmt.run(this.getExpiration(sessionData), sid);
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    }

    getExpiration(sessionData) {
      const cookieExpires = sessionData.cookie?.expires;
      if (cookieExpires) {
        return new Date(cookieExpires).getTime();
      }

      return Date.now() + ttlMs;
    }

    cleanupExpired() {
      this.cleanupStmt.run(Date.now());
    }
  })();
}

module.exports = {
  createSqliteSessionStore,
};
