/**
 * Backup-then-migrate. Before applying new migrations to an existing install, copy the
 * database to a backup (keeping the last 2). If a migration fails, restore the backup
 * so the user's logs are never left half-migrated.
 *
 * The steps are injected so this orchestration can be tested without a device.
 */
export type MigrationSteps = {
  /** True if the database already has migrations applied (i.e. not a fresh install). */
  isExistingInstall(): boolean;
  hasPendingMigrations(): boolean;
  backup(): Promise<void>;
  migrate(): Promise<void>;
  restore(): Promise<void>;
};

export type MigrationOutcome = 'up-to-date' | 'fresh-install' | 'migrated';

export class MigrationError extends Error {
  constructor(
    readonly stage: 'backup' | 'migrate' | 'restore',
    readonly cause: unknown,
  ) {
    super(`Database ${stage} failed`);
    this.name = 'MigrationError';
  }
}

export async function backupThenMigrate(steps: MigrationSteps): Promise<MigrationOutcome> {
  if (!steps.hasPendingMigrations()) return 'up-to-date';

  const existing = steps.isExistingInstall();
  if (existing) {
    try {
      await steps.backup();
    } catch (error) {
      // Never migrate without a backup of existing data.
      throw new MigrationError('backup', error);
    }
  }

  try {
    await steps.migrate();
  } catch (error) {
    if (existing) {
      try {
        await steps.restore();
      } catch (restoreError) {
        throw new MigrationError('restore', restoreError);
      }
    }
    throw new MigrationError('migrate', error);
  }
  return existing ? 'migrated' : 'fresh-install';
}

/** Minimal synchronous SQL access, satisfied by both expo-sqlite and better-sqlite3 wrappers. */
export type PragmaConnection = { exec(sql: string): void; all(sql: string): unknown[] };

/**
 * Runs migrations with foreign keys OFF, then verifies integrity before turning them
 * back on. drizzle-kit rebuilds SQLite tables (CREATE new → copy → DROP old → RENAME)
 * for many schema changes, and Drizzle runs the script inside a transaction where its
 * own `PRAGMA foreign_keys=OFF` is ignored. With foreign keys on, `DROP TABLE
 * symptom_logs` would silently cascade-delete every symptom item and tag.
 */
export async function withForeignKeysOff(conn: PragmaConnection, run: () => void | Promise<void>) {
  conn.exec('PRAGMA foreign_keys = OFF');
  try {
    await run();
    const violations = conn.all('PRAGMA foreign_key_check');
    if (violations.length > 0) {
      throw new Error(`Foreign key check failed after migration (${violations.length} rows)`);
    }
  } finally {
    conn.exec('PRAGMA foreign_keys = ON');
  }
}

type Journal = { entries: { when: number }[] };

/** Drizzle applies a migration when its journal `when` is newer than the last applied one. */
export function hasPending(journal: Journal, lastAppliedAt: number | null): boolean {
  if (lastAppliedAt === null) return journal.entries.length > 0;
  return journal.entries.some((entry) => entry.when > lastAppliedAt);
}
