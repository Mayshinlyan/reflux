import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '../schema';
import type { AppDb } from '../types';

export const MIGRATIONS_FOLDER = path.join(__dirname, '../../../drizzle');

/** An in-memory database with foreign keys on and all migrations applied, like the app's. */
export function createTestDb(options: { migrationsFolder?: string; file?: string } = {}) {
  const sqlite = new Database(options.file ?? ':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: options.migrationsFolder ?? MIGRATIONS_FOLDER });
  return { db: db as unknown as AppDb, sqlite };
}
