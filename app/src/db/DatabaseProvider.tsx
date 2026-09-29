import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

import { getDb, initDatabase } from './client';
import { MigrationError } from './migrate';
import { getAllSettings, type SettingKey, type Settings, setSetting } from './repositories/settings';
import type { AppDb } from './types';

type DatabaseState = { status: 'loading' } | { status: 'ready'; db: AppDb } | { status: 'error' };

type DatabaseContextValue = {
  db: AppDb;
  settings: Settings;
  updateSetting: <K extends SettingKey>(key: K, value: Settings[K]) => void;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

/**
 * Opens the on-device database and applies migrations (backing up first) before
 * rendering the app. `fallback` renders while loading; `errorView` if setup fails.
 */
export function DatabaseProvider({
  children,
  fallback,
  errorView,
}: {
  children: ReactNode;
  fallback: ReactNode;
  errorView: ReactNode;
}) {
  const [state, setState] = useState<DatabaseState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then(() => {
        if (!cancelled) setState({ status: 'ready', db: getDb() as unknown as AppDb });
      })
      .catch((error: unknown) => {
        const stage = error instanceof MigrationError ? error.stage : 'open';
        // Operation + code only: never the SQL error text, which could echo data.
        logger.error(`db.${stage}`, new AppError('DB_MIGRATION_FAILED'));
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') return fallback;
  if (state.status === 'error') return errorView;
  return <ReadyProvider db={state.db}>{children}</ReadyProvider>;
}

/** Holds settings in one place so every screen sees a change immediately. */
function ReadyProvider({ db, children }: { db: AppDb; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => getAllSettings(db));

  const updateSetting = useCallback(
    <K extends SettingKey>(key: K, value: Settings[K]) => {
      setSetting(db, key, value);
      setSettings(getAllSettings(db));
    },
    [db],
  );

  const value = useMemo(() => ({ db, settings, updateSetting }), [db, settings, updateSetting]);
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

function useDatabaseContext(): DatabaseContextValue {
  const value = useContext(DatabaseContext);
  if (!value) throw new Error('Must be used inside DatabaseProvider');
  return value;
}

export function useDb(): AppDb {
  return useDatabaseContext().db;
}

/** Current settings (shared across screens) plus a setter that saves them. Throws on invalid values. */
export function useSettings() {
  const { settings, updateSetting } = useDatabaseContext();
  return { settings, update: updateSetting };
}
