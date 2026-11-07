/**
 * Minimal in-memory D1 stand-in for tests.
 * Implements exactly the SQL statements used by src/db.js.
 */
export class FakeD1 {
  constructor() {
    this.apps = [];
    this.registry = new Map(); // `${app}\u0000${event}` -> { event, dim1_allow, dim2_allow }
    this.events = new Map(); // `${app}\u0000${day}\u0000${event}\u0000${dim1}\u0000${dim2}` -> row
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, ' ').trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    if (this.sql.startsWith('SELECT app, name FROM apps WHERE key_hash = ?')) {
      const row = this.db.apps.find((entry) => entry.key_hash === this.args[0]);
      return row ? { app: row.app, name: row.name } : null;
    }
    if (this.sql.startsWith('SELECT app FROM apps WHERE app = ?')) {
      const row = this.db.apps.find((entry) => entry.app === this.args[0]);
      return row ? { app: row.app } : null;
    }
    throw new Error(`FakeD1.first: unsupported SQL: ${this.sql}`);
  }

  async all() {
    if (this.sql.startsWith('SELECT app, name, created_at FROM apps ORDER BY app')) {
      return { results: this.db.apps.slice().sort((a, b) => a.app.localeCompare(b.app)) };
    }
    if (this.sql.startsWith('SELECT app, day, event, dim1, dim2, count FROM events_daily')) {
      const rows = [...this.db.events.values()];
      if (this.sql.includes('AND app = ?')) {
        const [fromDay, app] = this.args;
        return { results: rows.filter((row) => row.day >= fromDay && row.app === app) };
      }
      const [fromDay] = this.args;
      return { results: rows.filter((row) => row.day >= fromDay) };
    }
    if (this.sql.startsWith('SELECT event, dim1_allow, dim2_allow FROM registry WHERE app = ?')) {
      const app = this.args[0];
      return {
        results: [...this.db.registry.entries()]
          .filter(([key]) => key.startsWith(`${app}\u0000`))
          .map(([, value]) => value)
          .sort((a, b) => a.event.localeCompare(b.event)),
      };
    }
    throw new Error(`FakeD1.all: unsupported SQL: ${this.sql}`);
  }

  async run() {
    if (this.sql.startsWith('INSERT INTO apps (app, name, key_hash, created_at)')) {
      const [app, name, keyHash, createdAt] = this.args;
      this.db.apps.push({ app, name, key_hash: keyHash, created_at: createdAt });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith('INSERT INTO events_daily')) {
      const [app, day, event, dim1, dim2, count] = this.args;
      const key = [app, day, event, dim1, dim2].join('\u0000');
      const existing = this.db.events.get(key);
      if (existing) existing.count += count;
      else this.db.events.set(key, { app, day, event, dim1, dim2, count });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith('INSERT INTO registry')) {
      const [app, event, dim1, dim2] = this.args;
      const key = `${app}\u0000${event}`;
      this.db.registry.set(key, { event, dim1_allow: dim1, dim2_allow: dim2 });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith('DELETE FROM events_daily') || this.sql.startsWith('DELETE FROM registry') || this.sql.startsWith('DELETE FROM apps')) {
      return { meta: { changes: 1 } };
    }
    throw new Error(`FakeD1.run: unsupported SQL: ${this.sql}`);
  }
}
