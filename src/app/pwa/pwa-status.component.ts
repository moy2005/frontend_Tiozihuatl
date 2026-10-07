import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';
import { PwaService } from './pwa.service';
import { PublicContentPath } from './pwa-policy';

interface PwaNotice {
  key: string;
  kind: 'connection' | 'restored' | 'copy' | 'storage' | 'unsupported' | 'update' | 'error' | 'recovery';
  title: string;
  text: string;
  symbol: string;
  closable: boolean;
}

@Component({
  selector: 'app-pwa-status',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './pwa-status.component.html',
  styleUrl: './pwa-status.component.css',
})
export class PwaStatusComponent {
  readonly connection = inject(ConnectivityService);
  readonly content = inject(PublicContentService);
  readonly pwa = inject(PwaService);
  private readonly router = inject(Router);
  private readonly route = signal(this.router.url);
  private readonly dismissed = signal(new Set<string>());
  readonly copiedAt = computed(() => {
    const paths: Record<string, PublicContentPath> = { '/about': '/about', '/contactanos': '/contact', '/privacidad': '/privacidad', '/terminos': '/terminos' };
    const path = paths[this.route().split(/[?#]/)[0]];
    return path ? (this.connection.available() ? this.content.displayedCopies()[path] : this.content.displayedAt()[path]) : undefined;
  });
  readonly notices = computed(() => {
    const notices: PwaNotice[] = [];
    const add = (kind: PwaNotice['kind'], key: string, title: string, text: string, symbol: string, closable = true) =>
      notices.push({ kind, key, title, text, symbol, closable });
    if (!this.connection.available()) add('connection', this.connection.state(),
      this.connection.state() === 'offline' ? 'Estás sin conexión' : 'El servicio no responde',
      'La información descargada sigue disponible. El catálogo y los trámites necesitan conexión.', '↯');
    else if (this.connection.restored()) add('restored', 'restored', 'Conexión restablecida',
      'Ya puedes volver a los servicios. No enviamos operaciones pendientes automáticamente.', '✓');
    if (this.copiedAt()) add('copy', 'copy:' + this.route() + ':' + this.copiedAt(), 'Estás viendo una copia guardada',
      'La información puede haber cambiado desde su descarga.', '◷');
    if (this.content.storageError()) add('storage', 'storage', 'Descarga incompleta',
      'No pudimos guardar todo en este dispositivo. Revisa el espacio disponible y los permisos de almacenamiento.', '↓');
    if (this.pwa.unsupported()) add('unsupported', 'unsupported', 'Modo sin conexión no disponible',
      'Necesitas HTTPS y un navegador compatible. Puedes seguir navegando con conexión.', 'ⓘ');
    if (this.pwa.recoveryRequired()) add('recovery', 'recovery', 'Necesitamos recargar la aplicación', this.pwa.updateError(), '!', false);
    else if (this.pwa.updateError()) add('error', 'error:' + this.pwa.updateError(), 'Actualización pendiente', this.pwa.updateError(), '↻');
    else if (this.pwa.updateReady()) add('update', 'update:' + this.pwa.readyVersion(), 'Hay mejoras listas para ti',
      'Descargamos una nueva versión de la aplicación. Puedes abrirla ahora o continuar y hacerlo después.', '↑');
    return notices;
  });
  readonly visibleNotices = computed(() => this.notices().filter(notice => !notice.closable || !this.dismissed().has(notice.key)));
  readonly hiddenCount = computed(() => this.notices().length - this.visibleNotices().length);

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(event => this.route.set(event.urlAfterRedirects));
    effect(() => {
      const active = new Set(this.notices().map(notice => notice.key));
      untracked(() => {
        const previous = this.dismissed();
        const remaining = new Set([...previous].filter(key => active.has(key)));
        if (remaining.size !== previous.size) this.dismissed.set(remaining);
      });
    });
  }

  dismiss(notice: PwaNotice): void {
    if (notice.closable) this.dismissed.update(value => new Set([...value, notice.key]));
  }

  showNotices(): void { this.dismissed.set(new Set()); }

  async retry(): Promise<void> {
    if (await this.connection.check()) await this.content.prepare();
  }
}
