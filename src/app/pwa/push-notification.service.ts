import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../api/environments/environment';
import { ConnectivityService } from './connectivity.service';
import { SystemNotificationService } from './system-notification.service';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on' | 'busy' | 'local' | 'unconfigured' | 'pending';
interface PublicKeyResponse { data: { enabled: boolean; publicKey: string | null } }
const PREFERENCE = 'iest-system-notifications';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly toastr = inject(ToastrService);
  private readonly connection = inject(ConnectivityService);
  private readonly system = inject(SystemNotificationService);
  private readonly destroy = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly api = `${environment.apiUrl}/notifications`;
  private readonly started = signal(false);
  private readonly optedIn = signal(false);
  private readonly busy = signal(false);
  private readonly registered = signal(false);
  readonly permission = signal<NotificationPermission>('default');
  readonly serverState = signal<'unknown' | 'ready' | 'unconfigured' | 'unavailable'>('unknown');
  readonly active = computed(() => this.optedIn() && this.permission() === 'granted');
  readonly state = computed<PushState>(() => {
    if (!this.supported) return 'unsupported';
    if (this.permission() === 'denied') return 'denied';
    if (this.busy()) return 'busy';
    if (!this.active()) return 'off';
    if (this.registered()) return 'on';
    if (this.serverState() === 'unconfigured') return 'unconfigured';
    if (this.serverState() === 'unavailable') return 'pending';
    return 'local';
  });
  readonly statusText = computed(() => {
    switch (this.state()) {
      case 'on': return 'Avisos de conexión y del Instituto activados en este dispositivo.';
      case 'local': return 'Avisos de conexión activados en este dispositivo.';
      case 'unconfigured': return 'Avisos de conexión activados. Los avisos del Instituto aún no están disponibles.';
      case 'pending': return 'Avisos de conexión activados. Falta conectar los avisos del Instituto.';
      case 'denied': return 'Permite las notificaciones en la configuración del navegador para recibir avisos del sistema.';
      case 'unsupported': return 'Puedes consultar tus avisos en esta campana.';
      case 'busy': return 'Activando notificaciones…';
      default: return 'Activa los avisos del sistema en este dispositivo.';
    }
  });
  private currentUserId: () => number | string | null = () => null;
  private syncedKey = '';
  private generation = 0;
  private syncing?: Promise<void>;

  private get supported(): boolean {
    return this.browser && this.swPush.isEnabled && window.isSecureContext &&
      'Notification' in window && 'serviceWorker' in navigator;
  }

  constructor() {
    effect(() => {
      if (!this.started() || !this.active()) return;
      const state = this.connection.state();
      if (this.connection.confirmed()) untracked(() => {
        void this.system.connectionChanged(state, () => this.active() && this.connection.state() === state);
      });
      if (state === 'online') untracked(() => { void this.syncSession(); });
    });
  }

  start(): void {
    if (!this.supported || this.started()) return;
    this.permission.set(Notification.permission);
    try { this.optedIn.set(localStorage.getItem(PREFERENCE) === 'on'); } catch { /* session only */ }
    this.started.set(true);
    this.swPush.subscription.pipe(takeUntilDestroyed(this.destroy)).subscribe(sub => {
      if (!sub) { this.syncedKey = ''; this.registered.set(false); }
    });
    const refresh = () => {
      this.permission.set(Notification.permission);
      void this.syncSession();
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== PREFERENCE && event.key !== null) return;
      try { this.optedIn.set(localStorage.getItem(PREFERENCE) === 'on'); } catch { return; }
      if (!this.optedIn()) void this.disable(true);
      else refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', storage);
    navigator.serviceWorker.addEventListener('controllerchange', refresh);
    this.destroy.onDestroy(() => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', storage);
      navigator.serviceWorker.removeEventListener('controllerchange', refresh);
    });
    // Angular displays the native push; the bell refreshes through SwPush.
    // Do not duplicate every native notification with another toast.
  }

  async enable(): Promise<void> {
    if (!this.supported || this.busy()) return;
    this.start();
    this.busy.set(true);
    try {
      // Request before any network await to retain the user's gesture.
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission() : Notification.permission;
      this.permission.set(permission);
      if (permission !== 'granted') return;
      this.optedIn.set(true);
      try { localStorage.setItem(PREFERENCE, 'on'); } catch { /* session only */ }
      await this.syncSession();
    } catch {
      this.toastr.warning('No pudimos activar los avisos del sistema. Puedes consultar la campana.');
    } finally { this.busy.set(false); }
  }

  async disable(silent = false): Promise<void> {
    if (!this.supported) return;
    this.generation++;
    this.syncedKey = '';
    this.registered.set(false);
    if (!silent) {
      this.optedIn.set(false);
      try { localStorage.setItem(PREFERENCE, 'off'); } catch { /* session only */ }
    }
    try {
      const sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(5000)));
      if (!sub) return;
      // Revoke in the browser even offline; that push endpoint then expires.
      await this.swPush.unsubscribe();
      if (navigator.onLine) await firstValueFrom(this.http.delete(`${this.api}/subscribe`, {
        body: { endpoint: sub.endpoint },
      }).pipe(timeout(8000)));
    } catch {
      if (!silent) this.toastr.warning('No pudimos completar la baja. Puedes revocar el permiso desde el navegador.');
    }
  }

  /** Logout: the next account on this device must opt in again. */
  signOut(): Promise<void> {
    this.optedIn.set(false);
    return this.disable(true);
  }

  syncSession(currentUserId?: () => number | string | null): Promise<void> {
    if (currentUserId) this.currentUserId = currentUserId;
    if (!this.supported || !this.started()) return Promise.resolve();
    if (!this.currentUserId()) return this.disable(true);
    if (!this.active()) return Promise.resolve();
    if (this.syncing) return this.syncing;
    const userId = this.currentUserId();
    const generation = this.generation;
    const current = () => generation === this.generation && userId === this.currentUserId() && this.active();
    this.syncing = this.registerRemote(current, userId!).finally(() => { this.syncing = undefined; });
    return this.syncing;
  }

  private async registerRemote(current: () => boolean, userId: number | string): Promise<void> {
    if (!navigator.onLine || !this.connection.available()) {
      if (!this.registered()) this.serverState.set('unavailable');
      return;
    }
    try {
      let sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(5000)));
      if (!current()) return;
      if (sub && this.syncedKey === `${userId}|${sub.endpoint}`) return;
      const { data } = await firstValueFrom(this.http.get<PublicKeyResponse>(`${this.api}/public-key`).pipe(timeout(8000)));
      if (!current()) return;
      if (!data.enabled || !data.publicKey) {
        this.serverState.set('unconfigured');
        this.registered.set(false);
        return;
      }
      this.serverState.set('ready');
      if (!sub) sub = await this.swPush.requestSubscription({ serverPublicKey: data.publicKey });
      if (!current()) { await this.swPush.unsubscribe(); return; }
      await firstValueFrom(this.http.post(`${this.api}/subscribe`, sub.toJSON()).pipe(timeout(8000)));
      if (!current()) { await this.swPush.unsubscribe(); return; }
      this.syncedKey = `${userId}|${sub.endpoint}`;
      this.registered.set(true);
    } catch {
      if (current()) {
        this.registered.set(false);
        this.serverState.set('unavailable');
      }
    }
  }

  toggle(): Promise<void> { return this.active() ? this.disable() : this.enable(); }
}
