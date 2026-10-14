import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificacionBandeja, NotificacionesService } from '../../api/services/notificaciones.service';
import { PushNotificationService } from '../../pwa/push-notification.service';

const ICONOS: Record<string, string> = {
  prestamo: 'ph-book-bookmark',
  recordatorio: 'ph-alarm',
  aviso: 'ph-megaphone',
  prueba: 'ph-bell-ringing',
};

const ETIQUETAS: Record<string, string> = {
  prestamo: 'Préstamo',
  recordatorio: 'Recordatorio',
  aviso: 'Comunicado',
  prueba: 'Prueba',
};

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  /** `mobile` abre el panel a pantalla completa bajo la barra superior. */
  @Input() variant: 'desktop' | 'mobile' = 'desktop';

  readonly bandeja = inject(NotificacionesService);
  readonly push = inject(PushNotificationService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly abierto = signal(false);

  ngOnInit(): void {
    this.bandeja.attach();
  }

  ngOnDestroy(): void {
    this.bandeja.detach();
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.abierto.update(v => !v);
    if (this.abierto()) void this.bandeja.refresh();
  }

  abrir(item: NotificacionBandeja): void {
    void this.bandeja.marcarLeida(item);
    this.abierto.set(false);
    if (item.url?.startsWith('/')) void this.router.navigateByUrl(item.url);
  }

  etiqueta(categoria: string): string {
    return ETIQUETAS[categoria] || 'Aviso';
  }

  icono(categoria: string): string {
    return ICONOS[categoria] || 'ph-bell';
  }

  hace(fecha: string): string {
    const diff = Math.max(0, Date.now() - new Date(fecha).getTime());
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return d === 1 ? 'Ayer' : `Hace ${d} días`;
    return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.abierto() && !this.host.nativeElement.contains(event.target as Node)) this.abierto.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.abierto.set(false);
  }
}
