import { CONTENT_MAX_AGE, PublicContentPath, validPublicContent } from './pwa-policy';
import { InjectionToken } from '@angular/core';

export interface PublicSnapshot {
  key: string;
  path: PublicContentPath;
  savedAt: number;
  body: unknown;
}

export function usableSnapshot(value: PublicSnapshot | undefined, path: PublicContentPath, now = Date.now()): value is PublicSnapshot {
  return !!value && value.path === path && Number.isFinite(value.savedAt) && now >= value.savedAt && now - value.savedAt <= CONTENT_MAX_AGE && validPublicContent(path, value.body);
}

export class PublicContentStore {
  private database?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    this.database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tiozihuatl-public-content', 1);
      let settled = false;
      const timer = setTimeout(() => { settled = true; reject(new Error('Almacenamiento no disponible')); }, 3_000);
      request.onupgradeneeded = () => request.result.createObjectStore('pages', { keyPath: 'key' });
      request.onsuccess = () => {
        clearTimeout(timer);
        if (settled) { request.result.close(); return; }
        request.result.onversionchange = () => { request.result.close(); this.database = undefined; };
        resolve(request.result);
      };
      request.onerror = () => { clearTimeout(timer); reject(request.error); };
      request.onblocked = () => { clearTimeout(timer); settled = true; reject(new Error('Almacenamiento bloqueado')); };
    }).catch(error => { this.database = undefined; throw error; });
    return this.database;
  }

  async read(key: string): Promise<PublicSnapshot | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('pages', 'readonly').objectStore('pages').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async write(snapshot: PublicSnapshot): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('pages', 'readwrite');
      transaction.objectStore('pages').put(snapshot);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('pages', 'readwrite');
      transaction.objectStore('pages').delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const PUBLIC_CONTENT_STORE = new InjectionToken<Pick<PublicContentStore, 'read' | 'write' | 'remove'>>('PUBLIC_CONTENT_STORE', { providedIn: 'root', factory: () => new PublicContentStore() });
