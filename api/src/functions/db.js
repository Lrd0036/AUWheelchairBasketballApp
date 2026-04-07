const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../../data/apex.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS games   (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events  (id TEXT PRIMARY KEY, game_id TEXT, data TEXT NOT NULL);
`);

// ─── Cosmos-compatible shim ────────────────────────────────────────────────
// All methods return plain objects (not Promises), but the callers use
// `await` which safely resolves immediately on non-Promise values.

function getContainer(name) {
  const table = name; // "games" | "players" | "events"

  return {
    items: {
      readAll() {
        return {
          fetchAll() {
            const rows = db.prepare(`SELECT data FROM ${table}`).all();
            return { resources: rows.map((r) => JSON.parse(r.data)) };
          },
        };
      },

      create(item) {
        if (table === "events") {
          db.prepare("INSERT INTO events (id, game_id, data) VALUES (?, ?, ?)")
            .run(item.id, item.game_id ?? null, JSON.stringify(item));
        } else {
          db.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?)`)
            .run(item.id, JSON.stringify(item));
        }
        return { resource: item };
      },

      // Only used by events GET-one and events DELETE
      query(q) {
        return {
          fetchAll() {
            const idParam = q.parameters?.find((p) => p.name === "@id")?.value;
            if (idParam) {
              const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(idParam);
              return { resources: row ? [JSON.parse(row.data)] : [] };
            }
            const rows = db.prepare(`SELECT data FROM ${table}`).all();
            return { resources: rows.map((r) => JSON.parse(r.data)) };
          },
        };
      },
    },

    item(id /*, _partitionKey */) {
      return {
        read() {
          const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
          return { resource: row ? JSON.parse(row.data) : null };
        },

        replace(updated) {
          if (table === "events") {
            db.prepare("UPDATE events SET game_id = ?, data = ? WHERE id = ?")
              .run(updated.game_id ?? null, JSON.stringify(updated), id);
          } else {
            db.prepare(`UPDATE ${table} SET data = ? WHERE id = ?`)
              .run(JSON.stringify(updated), id);
          }
          return { resource: updated };
        },

        delete() {
          db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
          return {};
        },
      };
    },
  };
}

module.exports = { getContainer };
