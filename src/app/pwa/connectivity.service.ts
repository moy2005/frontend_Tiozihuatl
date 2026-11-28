import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from '../api/api.config';

export type ConnectionState = 'online' | 'offline' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  readonly state = signal<ConnectionState>(this.browser && !navigator.onLine ? 'offline' : 'online');
  readonly confirmed = signal(false);
  readonly available = computed(() => this.state() !== 'offline');
  readonly checking = signal(false);
  readonly restored = signal(false);
  private started = false;
  private pending?: Promise<boolean>;
  private lastCheck = 0;
  private epoch = 0;
  private awaitingRestoration = this.state() === 'offline';

  start(): void {
    if (!this.browser || this.started) return;
    this.started = true;
    const offline = () => this.zone.run(() => this.markOffline());
    const online = () => {
      if (this.pending) {
        void this.pending.then(() => {
          if (navigator.onLine && this.state() === 'offline') void this.check();
        });
      } else void this.check();
    };
    const visible = () => { if (document.visibilityState === 'visible') void this.check(); };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('offline', offline);
      window.addEventListener('online', online);
      document.addEventListener('visibilitychange', visible);
      const interval = setInterval(() => { if (document.visibilityState === 'visible') void this.check(); }, 60_000);
      this.destroy.onDestroy(() => {
        clearInterval(interval);
        window.removeEventListener('offline', offline);
        window.removeEventListener('online', online);
        document.removeEventListener('visibilitychange', visible);
      });
      void this.check();
    });
  }

  reportFailure(error: unknown): void {
    if (!(error instanceof HttpErrorResponse) || ![0, 408, 502, 503, 504].includes(error.status)) return;
    if (this.browser && !navigator.onLine) {
      this.markOffline();
    } else if (Date.now() - this.lastCheck > 5_000) {
      void this.check();
    }
  }

  check(): Promise<boolean> {
    if (!this.browser) return Promise.resolve(true);
    if (!navigator.onLine) {
      this.markOffline();
      return Promise.resolve(false);
    }
    if (this.pending) return this.pending;
    this.checking.set(true);
    const epoch = this.epoch;
    this.pending = firstValueFrom(this.http.get<{ status: string }>(`${API_URL}/health`, { cache: 'no-store' }).pipe(timeout(8_000)))
      .then(response => {
        if (response.status !== 'ok') throw new Error('Servicio no disponible');
        if (epoch !== this.epoch) return false;
        this.zone.run(() => {
          if (this.awaitingRestoration) this.restored.set(true);
          this.awaitingRestoration = false;
          this.state.set('online');
          this.confirmed.set(true);
        });
        return true;
      })
      .catch(() => {
        if (epoch !== this.epoch) return false;
        this.zone.run(() => {
          if (!navigator.onLine) this.markOffline();
          else {
            this.state.set('unavailable');
            this.confirmed.set(true);
          }
        });
        return false;
      })
      .finally(() => {
        this.lastCheck = Date.now();
        this.pending = undefined;
        this.zone.run(() => this.checking.set(false));
      });
    return this.pending;
  }

  private markOffline(): void {
    this.epoch++;
    this.awaitingRestoration = true;
    this.state.set('offline');
    this.restored.set(false);
    this.confirmed.set(true);
  }
}
