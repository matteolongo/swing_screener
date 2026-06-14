import type { StateStorage } from 'zustand/middleware';

// Minimal IndexedDB-backed StateStorage for zustand persist. IndexedDB has a far
// larger quota than localStorage (~hundreds of MB vs ~5MB), so it can hold a full
// screener result with per-candidate OHLCV price histories without hitting
// QuotaExceededError. Falls back to a no-op when IndexedDB is unavailable
// (e.g. SSR or the jsdom test environment), degrading to in-memory-only state.

const DB_NAME = 'swing-screener';
const STORE_NAME = 'state';
const DB_VERSION = 1;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) {
        open.result.createObjectStore(STORE_NAME);
      }
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, mode);
      const request = run(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    };
  });
}

export const indexedDbStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIndexedDb()) {
      return null;
    }
    try {
      const value = await withStore<string | undefined>('readonly', (store) => store.get(name));
      return value ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    if (!hasIndexedDb()) {
      return;
    }
    try {
      await withStore('readwrite', (store) => store.put(value, name));
    } catch (error) {
      console.warn(`screener result not persisted: ${String(error)}`);
    }
  },
  removeItem: async (name) => {
    if (!hasIndexedDb()) {
      return;
    }
    try {
      await withStore('readwrite', (store) => store.delete(name));
    } catch {
      /* ignore */
    }
  },
};
