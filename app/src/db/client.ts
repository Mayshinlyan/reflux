import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { backupDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import {
  backupThenMigrate,
  dropStalePortionColumn,
  hasPending,
  type MigrationOutcome,
  withForeignKeysOff,
} from './migrate';
import * as schema from './schema';

export const DATABASE_NAME = 'reflux.db';
/** Two rotating backup slots: slot 1 is the newest. */
const BACKUP_NAMES = ['reflux.backup-1.db', 'reflux.backup-2.db'] as const;

let expoDb: SQLiteDatabase | null = null;

function openRaw(): SQLiteDatabase {
  if (!expoDb) {
    expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
    expoDb.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }
  return expoDb;
}

export function getDb() {
  return drizzle(openRaw(), { schema });
}

function lastAppliedMigration(raw: SQLiteDatabase): number | null {
  const table = raw.getFirstSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  );
  if (!table) return null;
  const row = raw.getFirstSync<{ last: number | null }>(
    'SELECT MAX(created_at) AS last FROM __drizzle_migrations',
  );
  return row?.last ?? null;
}

async function copyDatabase(source: SQLiteDatabase, destName: string) {
  const dest = openDatabaseSync(destName);
  try {
    await backupDatabaseAsync({ sourceDatabase: source, destDatabase: dest });
  } finally {
    dest.closeSync();
  }
}

/** Opens the database and applies any pending migrations, backing up first. */
export async function initDatabase(): Promise<MigrationOutcome> {
  const raw = openRaw();
  const db = drizzle(raw, { schema });

  return backupThenMigrate({
    isExistingInstall: () => lastAppliedMigration(raw) !== null,
    hasPendingMigrations: () => hasPending(migrations.journal, lastAppliedMigration(raw)),
    backup: async () => {
      // Rotate: slot 1 → slot 2, then the live database → slot 1.
      const newest = openDatabaseSync(BACKUP_NAMES[0]);
      try {
        await copyDatabase(newest, BACKUP_NAMES[1]);
      } finally {
        newest.closeSync();
      }
      await copyDatabase(raw, BACKUP_NAMES[0]);
    },
    migrate: () => {
      const conn = {
        exec: (statement: string) => raw.execSync(statement),
        all: (statement: string) => raw.getAllSync(statement),
      };
      return withForeignKeysOff(conn, () => {
        dropStalePortionColumn(conn, migrations.journal, lastAppliedMigration(raw));
        return migrate(db, migrations);
      });
    },
    restore: async () => {
      const backup = openDatabaseSync(BACKUP_NAMES[0]);
      try {
        await backupDatabaseAsync({ sourceDatabase: backup, destDatabase: raw });
      } finally {
        backup.closeSync();
      }
    },
  });
}
