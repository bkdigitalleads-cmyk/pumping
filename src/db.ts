/**
 * On-device SQLite store. Volumes are mL, times epoch ms, days YYYY-MM-DD.
 *
 * After launch the schema only grows: never drop or rename a column or
 * table. A new column goes in as a new step in migrate() below, guarded by
 * PRAGMA user_version, so it runs once on every existing install.
 */
import * as SQLite from 'expo-sqlite';
import { Bag, BagLocation, Session } from './logic';

const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('pumping.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER NOT NULL,
          duration_sec INTEGER NOT NULL,
          left_ml REAL NOT NULL DEFAULT 0,
          right_ml REAL NOT NULL DEFAULT 0,
          note TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
        CREATE TABLE IF NOT EXISTS bags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label_no INTEGER NOT NULL,
          pumped_on TEXT NOT NULL,
          volume_ml REAL NOT NULL,
          location TEXT NOT NULL DEFAULT 'freezer',
          moved_at INTEGER,
          used_at INTEGER,
          discarded_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      await migrate(db);
      return db;
    })();
    // A failed open is retried on the next call instead of failing forever.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;
  // Version 1 is the tables above. Later steps go here, for example:
  // if (version < 2) await db.execAsync("ALTER TABLE bags ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

// ---------- settings (key/value) ----------

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
}

/** Every stored key with this prefix, prefix removed. */
export async function kvAll(prefix: string): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings WHERE key LIKE ?',
    [prefix + '%']
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key.slice(prefix.length)] = r.value;
  return out;
}

// ---------- sessions ----------

function rowToSession(r: any): Session {
  return {
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSec: r.duration_sec ?? 0,
    leftMl: r.left_ml ?? 0,
    rightMl: r.right_ml ?? 0,
    note: r.note ?? '',
  };
}

export interface SessionInput {
  startedAt: number;
  endedAt: number;
  leftMl: number;
  rightMl: number;
  note: string;
}

function cleanSession(i: SessionInput) {
  const endedAt = Math.max(i.startedAt, i.endedAt);
  return {
    startedAt: Math.round(i.startedAt),
    endedAt: Math.round(endedAt),
    durationSec: Math.round((endedAt - i.startedAt) / 1000),
    leftMl: Math.max(0, i.leftMl),
    rightMl: Math.max(0, i.rightMl),
    note: i.note.trim(),
  };
}

export async function insertSession(input: SessionInput): Promise<number> {
  const db = await getDb();
  const i = cleanSession(input);
  const now = Date.now();
  const res = await db.runAsync(
    `INSERT INTO sessions (started_at, ended_at, duration_sec, left_ml, right_ml, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.startedAt, i.endedAt, i.durationSec, i.leftMl, i.rightMl, i.note, now, now]
  );
  return res.lastInsertRowId;
}

export async function updateSession(id: number, input: SessionInput): Promise<void> {
  const db = await getDb();
  const i = cleanSession(input);
  await db.runAsync(
    `UPDATE sessions SET started_at = ?, ended_at = ?, duration_sec = ?, left_ml = ?, right_ml = ?,
       note = ?, updated_at = ? WHERE id = ?`,
    [i.startedAt, i.endedAt, i.durationSec, i.leftMl, i.rightMl, i.note, Date.now(), id]
  );
}

export async function deleteSession(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
}

export async function getSession(id: number): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM sessions WHERE id = ?', [id]);
  return row ? rowToSession(row) : null;
}

/** Sessions that started in [fromMs, toMs), oldest first. */
export async function getSessionsBetween(fromMs: number, toMs: number): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at ASC',
    [fromMs, toMs]
  );
  return rows.map(rowToSession);
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM sessions ORDER BY started_at ASC');
  return rows.map(rowToSession);
}

/** The session the next-pump time counts from: the one that started last. */
export async function getLastSession(): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM sessions ORDER BY started_at DESC, id DESC LIMIT 1');
  return row ? rowToSession(row) : null;
}

export async function countSessions(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sessions');
  return row?.n ?? 0;
}

// ---------- bags ----------

function rowToBag(r: any): Bag {
  return {
    id: r.id,
    labelNo: r.label_no,
    pumpedOn: r.pumped_on,
    volumeMl: r.volume_ml ?? 0,
    location: (r.location ?? 'freezer') as BagLocation,
    movedAt: r.moved_at ?? null,
    usedAt: r.used_at ?? null,
    discardedAt: r.discarded_at ?? null,
  };
}

export interface BagInput {
  labelNo: number;
  pumpedOn: string;
  volumeMl: number;
  location: BagLocation;
}

export async function insertBag(i: BagInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const res = await db.runAsync(
    `INSERT INTO bags (label_no, pumped_on, volume_ml, location, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Math.max(1, Math.round(i.labelNo)), i.pumpedOn, Math.max(0, i.volumeMl), i.location, now, now]
  );
  return res.lastInsertRowId;
}

/** A correction (typo, wrong freezer at the start): rewrites the bag and forgets any move. */
export async function updateBag(id: number, i: BagInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE bags SET label_no = ?, pumped_on = ?, volume_ml = ?, location = ?, moved_at = NULL, updated_at = ?
     WHERE id = ?`,
    [Math.max(1, Math.round(i.labelNo)), i.pumpedOn, Math.max(0, i.volumeMl), i.location, Date.now(), id]
  );
}

/** A real move, for example freezer to fridge to thaw. Its use-by follows the new place. */
export async function moveBag(id: number, location: BagLocation): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync('UPDATE bags SET location = ?, moved_at = ?, updated_at = ? WHERE id = ?', [location, now, now, id]);
}

export async function markBagUsed(id: number): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync('UPDATE bags SET used_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

export async function markBagDiscarded(id: number): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync('UPDATE bags SET discarded_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

/** Undo for used or discarded: the bag is back in the stash. */
export async function restoreBag(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE bags SET used_at = NULL, discarded_at = NULL, updated_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function deleteBag(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bags WHERE id = ?', [id]);
}

/** Every bag ever saved (used and discarded too), for numbering. */
export async function getAllBags(): Promise<Bag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM bags ORDER BY id ASC');
  return rows.map(rowToBag);
}

export async function getActiveBags(): Promise<Bag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM bags WHERE used_at IS NULL AND discarded_at IS NULL ORDER BY id ASC'
  );
  return rows.map(rowToBag);
}

export async function countActiveBags(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM bags WHERE used_at IS NULL AND discarded_at IS NULL'
  );
  return row?.n ?? 0;
}

/** Sessions and bags. Settings and purchases stay. */
export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM sessions; DELETE FROM bags;');
}
