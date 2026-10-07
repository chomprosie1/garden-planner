// IndexedDB holds large binary things (the trace image) that would overflow
// localStorage. They are never part of the JSON export.

const DB_NAME = 'garden-planner';
const STORE = 'blobs';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const saveBlob = (key: string, blob: Blob) => run('readwrite', (s) => s.put(blob, key)).then(() => undefined);
export const loadBlob = (key: string) => run<Blob | undefined>('readonly', (s) => s.get(key));
export const deleteBlob = (key: string) => run('readwrite', (s) => s.delete(key)).then(() => undefined);

/** Every key kept, for tidying up. */
export const blobKeys = () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((keys) => keys.map(String));
