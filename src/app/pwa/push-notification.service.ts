import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../api/environments/environment';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on' | 'busy';

interface PublicKeyResponse { data: { enabled: boolean; publicKey: string | null } }

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly toastr = inject(ToastrService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly api = `${environment.apiUrl}/notifications`;
  private started = false;
  private syncedKey = '';
  readonly state = signal<PushState>('unsupported');

  /** Revisa el estado actual y muestra en la app los avisos que llegan mientras está abierta. */
  start(): void {
    if (!this.browser || this.started) return;
    this.started = true;
    if (!this.swPush.isEnabled || !('Notification' in window)) return;
    this.state.set(Notification.permission === 'denied' ? 'denied' : 'off');
    this.swPush.subscription.subscribe(sub => {
      if (this.state() === 'busy') return;
      if (Notification.permission === 'denied') this.state.set('denied');
      else this.state.set(sub ? 'on' : 'off');
    });
    this.swPush.messages.subscribe(message => {
      const notification = (message as { notification?: { title?: string; body?: string } }).notification;
      if (notification?.title && document.visibilityState === 'visible') {
        this.toastr.info(notification.body || '', notification.title, { timeOut: 6000 });
      }
    });
  }

  async enable(): Promise<void> {
    if (!this.swPush.isEnabled) {
      this.toastr.warning('Las notificaciones requieren la versión instalada/producción de la app (HTTPS).');
      return;
    }
    this.state.set('busy');
    try {
      const { data } = await firstValueFrom(this.http.get<PublicKeyResponse>(`${this.api}/public-key`));
      if (!data.enabled || !data.publicKey) throw new Error('El servidor no tiene notificaciones configuradas.');
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: data.publicKey });
      await firstValueFrom(this.http.post(`${this.api}/subscribe`, subscription.toJSON()));
      this.state.set('on');
      this.toastr.success('Recibirás avisos del Instituto en este dispositivo.', 'Notificaciones activadas');
    } catch (error) {
      if (Notification.permission === 'denied') {
        this.state.set('denied');
        this.toastr.warning('Bloqueaste las notificaciones. Puedes permitirlas desde el candado de la barra de direcciones.');
      } else {
        this.state.set('off');
        this.toastr.error(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.');
      }
    }
  }

  async disable(silent = false): Promise<void> {
    if (!this.swPush.isEnabled) return;
    const subscription = await firstValueFrom(this.swPush.subscription).catch(() => null);
    if (!subscription) { this.state.set('off'); return; }
    this.state.set('busy');
    try {
      await firstValueFrom(this.http.delete(`${this.api}/subscribe`, { body: { endpoint: subscription.endpoint } })).catch(() => {});
      await this.swPush.unsubscribe();
      if (!silent) this.toastr.info('Ya no recibirás avisos en este dispositivo.', 'Notificaciones desactivadas');
    } finally {
      this.state.set('off');
    }
  }

  /**
   * Mantiene la suscripción de este navegador ligada al usuario con sesión activa:
   * si cambió el usuario la reasigna en el backend y, sin sesión, la da de baja
   * para que el dispositivo no siga recibiendo avisos de otra cuenta.
   */
  async syncSession(currentUserId: () => number | string | null): Promise<void> {
    if (!this.browser || !this.started || !this.swPush.isEnabled || this.state() === 'busy') return;
    const userId = currentUserId();
    const subscription = await firstValueFrom(this.swPush.subscription).catch(() => null);
    if (!subscription) { this.syncedKey = ''; return; }
    if (!userId) { this.syncedKey = ''; await this.disable(true); return; }
    const key = `${userId}|${subscription.endpoint}`;
    if (key === this.syncedKey) return;
    this.syncedKey = key;
    try {
      await firstValueFrom(this.http.post(`${this.api}/subscribe`, subscription.toJSON()));
    } catch {
      this.syncedKey = '';
    }
  }

  toggle(): Promise<void> {
    return this.state() === 'on' ? this.disable() : this.enable();
  }

  async sendTest(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/test`, {}));
  }
}
