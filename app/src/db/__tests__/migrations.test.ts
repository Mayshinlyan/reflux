/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import {
  backupThenMigrate,
  hasPending,
  MigrationError,
  type MigrationSteps,
  withForeignKeysOff,
} from '../migrate';
import { createSymptomLog, listSymptomLogs } from '../repositories/symptoms';
import * as schema from '../schema';
import type { AppDb } from '../types';
import { createTestDb, MIGRATIONS_FOLDER } from './testDb';

const EXPECTED_TABLES = [
  'app_settings',
  'food_logs',
  'medication_logs',
  'medications',
  'symptom_log_items',
  'symptom_log_tags',
  'symptom_logs',
];
const DAY = { from: '2026-09-28T00:00:00.000Z', to: '2026-09-29T00:00:00.000Z' };

function tables(sqlite: Database.Database): string[] {
  return (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[]
  )
    .map((row) => row.name)
    .filter((name) => name !== '__drizzle_migrations');
}

/** Copies the real migrations into a temp folder and appends one more, as a future release would. */
function migrationsWithExtra(sqlText: string, tag = '0001_future'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflux-migrations-'));
  fs.cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta/_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const last = journal.entries[journal.entries.length - 1];
  journal.entries.push({ ...last, idx: last.idx + 1, when: last.when + 1000, tag });
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  fs.writeFileSync(path.join(dir, `${tag}.sql`), sqlText);
  return dir;
}

/** A copy of the real migrations folder holding only the first `count` migrations. */
function firstMigrations(count: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflux-migrations-'));
  fs.cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta/_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  journal.entries = journal.entries.slice(0, count);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe('migrations', () => {
  it('0001 keeps existing meals and lets a meal be saved without a verdict', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: firstMigrations(1) });
    const analysis = JSON.stringify({ isFood: true, mealName: 'Mint tea' });
    sqlite
      .prepare(
        `INSERT INTO food_logs (entry_type, source, input_text, meal_name, overall_verdict, analysis, analysis_meta, logged_at, tz)
         VALUES (?, 'text', 'mint tea', 'Mint tea', 'caution', ?, '{"model":"m"}', '2026-09-28T19:45:00.000Z', 'UTC')`,
      )
      .run('diary', analysis);
    sqlite
      .prepare(
        `INSERT INTO food_logs (entry_type, source, meal_name, overall_verdict, analysis, analysis_meta, logged_at, tz)
         VALUES ('check', 'text', 'Tea', 'ok', ?, '{"model":"m"}', '2026-09-28T20:00:00.000Z', 'UTC')`,
      )
      .run(analysis);

    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const rows = sqlite
      .prepare('SELECT id, entry_type, overall_verdict, analysis FROM food_logs ORDER BY id')
      .all();
    expect(rows).toEqual([
      { id: 1, entry_type: 'diary', overall_verdict: 'caution', analysis },
      { id: 2, entry_type: 'check', overall_verdict: 'ok', analysis },
    ]);
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO food_logs (entry_type, source, meal_name, logged_at, tz)
           VALUES ('diary', 'text', 'Toast', '2026-09-29T08:00:00.000Z', 'UTC')`,
        )
        .run(),
    ).not.toThrow();
    // The CHECK constraints and the diary index survive the table rebuild.
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO food_logs (entry_type, source, meal_name, overall_verdict, logged_at, tz)
           VALUES ('diary', 'text', 'Bad', 'nope', '2026-09-29T08:00:00.000Z', 'UTC')`,
        )
        .run(),
    ).toThrow();
    const index = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get('food_logs_diary_logged_at_idx');
    expect(index).toBeTruthy();
    sqlite.close();
  });

  it('creates every table on a fresh install', () => {
    const { sqlite } = createTestDb();
    expect(tables(sqlite)).toEqual(EXPECTED_TABLES);
  });

  it('applies a later additive migration over existing data without losing it', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reflux-db-')), 'reflux.db');
    const first = createTestDb({ file });
    createSymptomLog(first.db, {
      items: [{ key: 'heartburn' }],
      loggedAt: '2026-09-28T08:00:00.000Z',
    });
    first.sqlite.close();

    const folder = migrationsWithExtra('ALTER TABLE `symptom_logs` ADD `mood` text;');
    const second = createTestDb({ file, migrationsFolder: folder });

    const columns = (
      second.sqlite.prepare('PRAGMA table_info(symptom_logs)').all() as { name: string }[]
    ).map((column) => column.name);
    expect(columns).toContain('mood');
    expect(listSymptomLogs(second.db, DAY)).toHaveLength(1);
  });

  it('restores the backup when a migration fails, keeping existing logs', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflux-db-'));
    const file = path.join(dir, 'reflux.db');
    const backupFile = path.join(dir, 'reflux.backup-1.db');
    const seeded = createTestDb({ file });
    createSymptomLog(seeded.db, {
      items: [{ key: 'cough' }],
      loggedAt: '2026-09-28T08:00:00.000Z',
    });
    seeded.sqlite.close();

    // A broken future migration: the first statement succeeds, the second fails.
    const folder = migrationsWithExtra(
      'ALTER TABLE `symptom_logs` ADD `mood` text;\n--> statement-breakpoint\nALTER TABLE `nope` ADD `x` text;',
    );
    let sqlite = new Database(file);
    const reportError = jest.fn();

    const steps: MigrationSteps = {
      isExistingInstall: () => true,
      hasPendingMigrations: () => true,
      backup: async () => {
        await sqlite.backup(backupFile);
      },
      migrate: async () => {
        migrate(drizzle(sqlite, { schema }), { migrationsFolder: folder });
      },
      restore: async () => {
        sqlite.close();
        fs.copyFileSync(backupFile, file);
        sqlite = new Database(file);
      },
    };

    await expect(
      backupThenMigrate(steps).catch((error) => (reportError(error), Promise.reject(error))),
    ).rejects.toThrow(MigrationError);
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({ stage: 'migrate' });

    const db = drizzle(sqlite, { schema }) as unknown as AppDb;
    expect(listSymptomLogs(db, DAY)).toEqual([
      expect.objectContaining({ items: [{ key: 'cough', score: 1 }] }),
    ]);
    const columns = (sqlite.prepare('PRAGMA table_info(symptom_logs)').all() as { name: string }[]).map(
      (column) => column.name,
    );
    expect(columns).not.toContain('mood');
    sqlite.close();
  });
});

describe('backupThenMigrate', () => {
  function fakeSteps(overrides: Partial<MigrationSteps> = {}) {
    const calls: string[] = [];
    const steps: MigrationSteps = {
      isExistingInstall: () => true,
      hasPendingMigrations: () => true,
      backup: async () => void calls.push('backup'),
      migrate: async () => void calls.push('migrate'),
      restore: async () => void calls.push('restore'),
      ...overrides,
    };
    return { steps, calls };
  }

  it('does nothing when there is nothing to migrate', async () => {
    const { steps, calls } = fakeSteps({ hasPendingMigrations: () => false });
    await expect(backupThenMigrate(steps)).resolves.toBe('up-to-date');
    expect(calls).toEqual([]);
  });

  it('skips the backup on a fresh install', async () => {
    const { steps, calls } = fakeSteps({ isExistingInstall: () => false });
    await expect(backupThenMigrate(steps)).resolves.toBe('fresh-install');
    expect(calls).toEqual(['migrate']);
  });

  it('backs up before migrating an existing install', async () => {
    const { steps, calls } = fakeSteps();
    await expect(backupThenMigrate(steps)).resolves.toBe('migrated');
    expect(calls).toEqual(['backup', 'migrate']);
  });

  it('never migrates if the backup fails', async () => {
    const { steps, calls } = fakeSteps({
      backup: async () => {
        throw new Error('disk full');
      },
    });
    await expect(backupThenMigrate(steps)).rejects.toMatchObject({ stage: 'backup' });
    expect(calls).toEqual([]);
  });

  it('restores the backup if the migration fails', async () => {
    const { steps, calls } = fakeSteps({
      migrate: async () => {
        throw new Error('bad sql');
      },
    });
    await expect(backupThenMigrate(steps)).rejects.toMatchObject({ stage: 'migrate' });
    expect(calls).toEqual(['backup', 'restore']);
  });
});

describe('hasPending', () => {
  const journal = { entries: [{ when: 100 }, { when: 200 }] };

  it('detects fresh installs and newer migrations', () => {
    expect(hasPending(journal, null)).toBe(true);
    expect(hasPending(journal, 100)).toBe(true);
    expect(hasPending(journal, 200)).toBe(false);
    expect(hasPending({ entries: [] }, null)).toBe(false);
  });
});

/** The script drizzle-kit generates when a SQLite table must be rebuilt (e.g. a CHECK change). */
const REBUILD_SYMPTOM_LOGS = [
  'PRAGMA foreign_keys=OFF;',
  "CREATE TABLE `__new_symptom_logs` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `kind` text DEFAULT 'quick' NOT NULL, `logged_at` text NOT NULL, `tz` text NOT NULL, `notes` text, `created_at` text NOT NULL, `updated_at` text NOT NULL);",
  'INSERT INTO `__new_symptom_logs` SELECT `id`, `kind`, `logged_at`, `tz`, `notes`, `created_at`, `updated_at` FROM `symptom_logs`;',
  'DROP TABLE `symptom_logs`;',
  'ALTER TABLE `__new_symptom_logs` RENAME TO `symptom_logs`;',
  'PRAGMA foreign_keys=ON;',
].join('\n--> statement-breakpoint\n');

describe('table rebuild migrations', () => {
  function seededDb() {
    const { db, sqlite } = createTestDb();
    createSymptomLog(db, {
      items: [{ key: 'heartburn' }],
      tags: ['stress'],
      loggedAt: '2026-09-28T08:00:00.000Z',
    });
    return { db, sqlite, folder: migrationsWithExtra(REBUILD_SYMPTOM_LOGS) };
  }
  const childRows = (sqlite: Database.Database) =>
    (
      sqlite
        .prepare(
          'SELECT (SELECT COUNT(*) FROM symptom_log_items) + (SELECT COUNT(*) FROM symptom_log_tags) AS n',
        )
        .get() as {
        n: number;
      }
    ).n;

  it('would cascade-delete child rows if foreign keys stayed on (why withForeignKeysOff exists)', () => {
    const { sqlite, folder } = seededDb();
    migrate(drizzle(sqlite, { schema }), { migrationsFolder: folder });
    expect(childRows(sqlite)).toBe(0);
  });

  it('keeps symptom items and tags when run with foreign keys off', async () => {
    const { db, sqlite, folder } = seededDb();
    await withForeignKeysOff(
      { exec: (statement) => sqlite.exec(statement), all: (statement) => sqlite.prepare(statement).all() },
      () => migrate(drizzle(sqlite, { schema }), { migrationsFolder: folder }),
    );

    expect(childRows(sqlite)).toBe(2);
    expect(listSymptomLogs(db, DAY)[0]).toMatchObject({
      items: [{ key: 'heartburn' }],
      tags: ['stress'],
    });
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('fails (so the backup is restored) if a migration leaves broken references', async () => {
    const { sqlite } = createTestDb();
    const conn = {
      exec: (statement: string) => sqlite.exec(statement),
      all: (statement: string) => sqlite.prepare(statement).all(),
    };

    await expect(
      withForeignKeysOff(conn, () => {
        sqlite.exec(
          "INSERT INTO symptom_log_items (symptom_log_id, item_key, score) VALUES (999, 'cough', 2)",
        );
      }),
    ).rejects.toThrow(/Foreign key check failed/);
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('drizzle/migrations.js (the bundle the phone uses)', () => {
  it('imports every migration in the journal, in order', () => {
    const source = fs.readFileSync(path.join(MIGRATIONS_FOLDER, 'migrations.js'), 'utf8');
    const journal = JSON.parse(
      fs.readFileSync(path.join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'),
    ) as {
      entries: { idx: number; tag: string }[];
    };
    const imports = [...source.matchAll(/import (m\d{4}) from '\.\/([\w-]+)\.sql'/g)].map((match) => [
      match[1],
      match[2],
    ]);

    expect(imports).toEqual(
      journal.entries.map((entry) => [`m${String(entry.idx).padStart(4, '0')}`, entry.tag]),
    );
    for (const [, tag] of imports) {
      expect(fs.existsSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`))).toBe(true);
    }
  });
});
