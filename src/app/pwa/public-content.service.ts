import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { API_URL } from '../api/api.config';
import { ConnectivityService } from './connectivity.service';
import { PUBLIC_CONTENT_PATHS, PublicContentPath, validPublicContent } from './pwa-policy';
import { PUBLIC_CONTENT_STORE, PublicSnapshot, usableSnapshot } from './public-content.store';

@Injectable({ providedIn: 'root' })
export class PublicContentService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly connection = inject(ConnectivityService);
  private readonly store = inject(PUBLIC_CONTENT_STORE);
  private readonly pending = new Map<PublicContentPath, Promise<{ snapshot: PublicSnapshot; cached: boolean }>>();
  readonly saved = signal<Partial<Record<PublicContentPath, number>>>({});
  readonly displayedCopies = signal<Partial<Record<PublicContentPath, number>>>({});
  readonly displayedAt = signal<Partial<Record<PublicContentPath, number>>>({});
  readonly storageError = signal(false);
  readonly preparing = signal(false);
  readonly iconsReady = signal(false);
  readonly complete = computed(() => PUBLIC_CONTENT_PATHS.every(path => !!this.saved()[path]));
  readonly oldestCopy = computed(() => this.complete() ? Math.min(...Object.values(this.saved()) as number[]) : null);

  async get(path: PublicContentPath, background = false): Promise<unknown> {
    if (!PUBLIC_CONTENT_PATHS.includes(path)) throw new Error('Contenido no autorizado para descarga');
    let request = this.pending.get(path);
    if (!request) {
      request = this.load(path).finally(() => this.pending.delete(path));
      this.pending.set(path, request);
    }
    try {
      const result = await request;
      if (!background) {
        this.displayedCopies.update(value => ({ ...value, [path]: result.cached ? result.snapshot.savedAt : undefined }));
        this.displayedAt.update(value => ({ ...value, [path]: result.snapshot.savedAt }));
      }
      return result.snapshot.body;
    } catch (error) {
      if (!background) {
        this.displayedCopies.update(value => ({ ...value, [path]: undefined }));
        this.displayedAt.update(value => ({ ...value, [path]: undefined }));
      }
      throw error;
    }
  }

  async prepare(): Promise<void> {
    if (!this.browser || this.preparing()) return;
    this.preparing.set(true);
    this.storageError.set(false);
    try {
      await Promise.allSettled(PUBLIC_CONTENT_PATHS.map(path => this.get(path, true)));
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) await this.prepareIcons();
    }
    finally { this.preparing.set(false); }
  }

  async prepareIcons(): Promise<void> {
    if (!this.browser || !this.complete()) return;
    const names = new Set<string>();
    for (const path of PUBLIC_CONTENT_PATHS) {
      const snapshot = await this.store.read(`${API_URL}${path}`).catch(() => undefined);
      if (!usableSnapshot(snapshot, path)) { this.iconsReady.set(false); return; }
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') {
          for (const [key, child] of Object.entries(value)) {
            if ((key === 'icono' || key === 'icon') && typeof child === 'string' && /^[a-z][a-z0-9-]{0,70}$/.test(child)) names.add(child);
            visit(child);
          }
        } else if (typeof value === 'string') {
          for (const match of value.matchAll(/<ion-icon\s[^>]*name=["']([a-z][a-z0-9-]{0,70})["']/g)) names.add(match[1]);
        }
      };
      visit(snapshot.body);
    }
    const results = await Promise.allSettled([...names].map(async name => {
      const response = await fetch(new URL(`assets/ionicons/svg/${name}.svg`, document.baseURI), { signal: AbortSignal.timeout(10_000) });
      if (!response.ok || !response.headers.get('content-type')?.includes('image/svg')) throw new Error('Icono no disponible');
    }));
    this.iconsReady.set(results.every(result => result.status === 'fulfilled'));
  }

  private async load(path: PublicContentPath): Promise<{ snapshot: PublicSnapshot; cached: boolean }> {
    const key = `${API_URL}${path}`;
    let failure: unknown = new HttpErrorResponse({ status: 0, statusText: 'Sin conexión', url: key });
    if (this.connection.available()) {
      try {
        const body = await firstValueFrom(this.http.get<unknown>(key, { cache: 'no-store', credentials: 'omit' }).pipe(timeout(10_000)));
        if (!validPublicContent(path, body) || JSON.stringify(body).length > 2_000_000) throw new Error('Contenido público inválido');
        const snapshot: PublicSnapshot = { key, path, savedAt: Date.now(), body };
        if (this.browser) {
          try {
            await this.store.write(snapshot);
            this.saved.update(value => ({ ...value, [path]: snapshot.savedAt }));
          } catch { this.storageError.set(true); this.saved.update(value => ({ ...value, [path]: undefined })); }
        }
        return { snapshot, cached: false };
      } catch (error) {
        failure = error;
        if (error instanceof HttpErrorResponse && error.status > 0 && error.status < 500) {
          if (this.browser) await this.store.remove(key).catch(() => undefined);
          this.saved.update(value => ({ ...value, [path]: undefined }));
          throw error;
        }
        this.connection.reportFailure(error instanceof TimeoutError ? new HttpErrorResponse({ status: 0 }) : error);
      }
    }
    if (this.browser) {
      try {
        const snapshot = await this.store.read(key);
        if (snapshot?.key === key && usableSnapshot(snapshot, path)) {
          this.saved.update(value => ({ ...value, [path]: snapshot.savedAt }));
          return { snapshot, cached: true };
        }
        if (snapshot) await this.store.remove(key);
      } catch { this.storageError.set(true); }
    }
    this.saved.update(value => ({ ...value, [path]: undefined }));
    throw failure;
  }
}
