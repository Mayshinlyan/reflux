import { useSyncExternalStore } from 'react';

/** Whether the quick log arch is open, and the day it logs for (a day tapped in Today's week strip). */
export type LogArchState = { open: boolean; date?: string };

const CLOSED: LogArchState = { open: false };

let state: LogArchState = CLOSED;
const listeners = new Set<() => void>();

function set(next: LogArchState): void {
  if (next.open === state.open && next.date === state.date) return;
  state = next;
  for (const listener of listeners) listener();
}

/** Opens the arch. With a `date`, the flow the person picks logs for that day. */
export function openLogArch(date?: string): void {
  set({ open: true, date });
}

export function closeLogArch(): void {
  set(CLOSED);
}

export function getLogArch(): LogArchState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The arch's state; the tab bar draws it and Today highlights the tapped day. */
export function useLogArch(): LogArchState {
  return useSyncExternalStore(subscribe, getLogArch, getLogArch);
}
