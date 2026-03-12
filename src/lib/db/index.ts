import Database from 'better-sqlite3';
import { type Database as DatabaseType } from 'better-sqlite3';
import { readFileSync } from 'node:fs';

let db: DatabaseType | null = null;

/**
 * Returns the singleton database instance.
 * Creates and configures it on first call.
 */
export function getDb(): DatabaseType {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || 'atlas.db';
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Initializes the database by running the schema SQL file.
 * Safe to call multiple times thanks to IF NOT EXISTS clauses.
 */
export function initDb(): void {
  const schemaPath = new URL('./schema.sql', import.meta.url);
  const schemaSql = readFileSync(schemaPath, 'utf-8');
  const database = getDb();
  database.exec(schemaSql);
}

/**
 * Executes an INSERT/UPDATE/DELETE statement.
 * Returns the result with changes count and lastInsertRowid.
 */
export function run(sql: string, ...params: unknown[]): Database.RunResult {
  return getDb().prepare(sql).run(...params);
}

/**
 * Executes a SELECT query and returns the first matching row or undefined.
 */
export function get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

/**
 * Executes a SELECT query and returns all matching rows.
 */
export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

/**
 * Closes the database connection. Useful for cleanup in tests.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
