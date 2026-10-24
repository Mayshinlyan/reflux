const listeners = new Set<() => void>();

/** Calls `listener` whenever entries change somewhere else (an Undo brings one back). Returns the unsubscribe. */
export function onEntriesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tells every screen showing entries to load them again. One failing listener never stops the others. */
export function notifyEntriesChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // The entries are already saved; a screen that fails to refresh still reloads on its next focus.
    }
  }
}
