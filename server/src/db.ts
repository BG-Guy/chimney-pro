import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "chimney-pro.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rawTicketText TEXT NOT NULL DEFAULT '',
    partsCost REAL NOT NULL DEFAULT 0,
    scheduledDate TEXT,
    needsRepairTeam INTEGER NOT NULL DEFAULT 0,
    depositAmount REAL NOT NULL DEFAULT 0,
    depositMethod TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    description TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0,
    sortOrder INTEGER NOT NULL DEFAULT 0
  );
`);
