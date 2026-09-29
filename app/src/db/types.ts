import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous Drizzle SQLite database with our schema: expo-sqlite on the phone,
 * better-sqlite3 in tests. Repositories take this so the same code runs in both.
 */
export type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>;
