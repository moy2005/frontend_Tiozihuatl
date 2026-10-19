import { ConnectionState } from './connectivity.service';

// The transaction serializes competing tabs and survives reloads. No user data.
export async function claimConnectionNotice(state: ConnectionState): Promise<boolean> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('tiozihuatl-connection-notices', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Almacenamiento no disponible'));
  });
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const request = store.get('connection');
      let claimed = false;
      request.onsuccess = () => {
        const previous = request.result as ConnectionState | undefined;
        claimed = previous !== state && (state !== 'online' || previous !== undefined);
        store.put(state, 'connection');
      };
      tx.oncomplete = () => resolve(claimed);
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
