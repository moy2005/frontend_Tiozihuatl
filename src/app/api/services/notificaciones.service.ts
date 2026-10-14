import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

export interface NotificacionBandeja {
  id_notificacion: number;
  categoria: 'prestamo' | 'recordatorio' | 'aviso' | 'prueba' | string;
  titulo: string;
  mensaje: string;
  url: string | null;
  fecha: string;
  leida: boolean;
}

const POLL_MS = 90_000;

/** Bandeja de notificaciones dentro de la web (independiente de que el usuario active el push). */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly api = `${environment.apiUrl}/notifications`;
  private consumers = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listening = false;

  readonly items = signal<NotificacionBandeja[]>([]);
  readonly noLeidas = signal(0);
  readonly cargando = signal(false);
  readonly cargada = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  /** Cada campana visible se registra; el sondeo solo corre mientras haya al menos una. */
  attach(): void {
    if (!this.browser) return;
    this.consumers++;
    if (this.consumers > 1) return;
    this.listenPush();
    void this.refresh();
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.refreshCount();
    }, POLL_MS);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  detach(): void {
    if (!this.browser || this.consumers === 0) return;
    this.consumers--;
    if (this.consumers === 0) this.stopPolling();
  }

  async refresh(): Promise<void> {
    this.cargando.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: { items: NotificacionBandeja[]; noLeidas: number } }>(`${this.api}?limit=20`),
      );
      this.items.set(res.data.items);
      this.noLeidas.set(res.data.noLeidas);
      this.cargada.set(true);
    } catch {
      // Sin conexión o sesión expirada: se conserva lo último mostrado.
    } finally {
      this.cargando.set(false);
    }
  }

  async refreshCount(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ data: { noLeidas: number } }>(`${this.api}/unread-count`));
      const previous = this.noLeidas();
      this.noLeidas.set(res.data.noLeidas);
      if (res.data.noLeidas !== previous) void this.refresh();
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }

  async marcarLeida(item: NotificacionBandeja): Promise<void> {
    if (item.leida) return;
    this.items.update(list => list.map(n => (n.id_notificacion === item.id_notificacion ? { ...n, leida: true } : n)));
    this.noLeidas.update(n => Math.max(0, n - 1));
    await firstValueFrom(this.http.patch(`${this.api}/${item.id_notificacion}/read`, {})).catch(() => this.refresh());
  }

  async marcarTodas(): Promise<void> {
    if (!this.noLeidas()) return;
    this.items.update(list => list.map(n => ({ ...n, leida: true })));
    this.noLeidas.set(0);
    await firstValueFrom(this.http.patch(`${this.api}/read-all`, {})).catch(() => this.refresh());
  }

  private listenPush(): void {
    if (this.listening || !this.swPush.isEnabled) return;
    this.listening = true;
    // Un push recibido con la app abierta actualiza la bandeja al instante.
    this.swPush.messages.subscribe(() => {
      if (this.consumers > 0) void this.refresh();
    });
  }

  private readonly onVisible = () => {
    if (document.visibilityState === 'visible' && this.consumers > 0) void this.refreshCount();
  };

  private stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.browser) document.removeEventListener('visibilitychange', this.onVisible);
    this.items.set([]);
    this.noLeidas.set(0);
    this.cargada.set(false);
  }
}
