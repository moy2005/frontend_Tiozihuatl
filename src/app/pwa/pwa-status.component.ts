import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';
import { PwaService } from './pwa.service';
import { PublicContentPath } from './pwa-policy';

@Component({
  selector: 'app-pwa-status',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    @if (!connection.available() || pwa.updateReady() || pwa.updateError() || connection.restored() || copiedAt() || content.storageError() || pwa.unsupported()) {
      <aside class="pwa-status" aria-label="Estado de la aplicación">
        <div role="status" aria-live="polite">
          @if (!connection.available()) {
            <strong>{{ connection.state() === 'offline' ? 'Sin conexión a internet' : 'No se puede conectar con el servicio' }}</strong>
            <p>Puedes consultar la información institucional descargada. El catálogo y los trámites requieren conexión.</p>
            <button type="button" (click)="retry()" [disabled]="connection.checking()">{{ connection.checking() ? 'Comprobando…' : 'Reintentar conexión' }}</button>
            <a routerLink="/sin-conexion">Ver páginas disponibles</a>
          } @else if (connection.restored()) {
            <strong>Conexión restablecida</strong>
            <p>Ya puedes volver a los servicios. Ninguna operación pendiente se envió automáticamente.</p>
            <button type="button" (click)="connection.restored.set(false)">Entendido</button>
          }
          @if (copiedAt()) {
            <p>Esta página muestra una copia guardada el {{ copiedAt() | date:'dd/MM/yyyy HH:mm' }}. Puede haber cambios posteriores.</p>
            @if (connection.available()) { <button type="button" (click)="pwa.reload()">Actualizar página</button> }
          }
          @if (content.storageError()) { <p>No se pudo guardar todo el contenido en este dispositivo. Libera espacio o permite el almacenamiento y vuelve a intentar.</p> }
          @if (pwa.unsupported()) { <p>La instalación y el modo sin conexión requieren un navegador compatible y una conexión HTTPS.</p> }
          @if (pwa.updateError()) { <p>{{ pwa.updateError() }}</p> }
          @if (pwa.updateReady() || pwa.updateError()) {
            @if (pwa.updateReady()) { <strong>Hay una nueva versión disponible</strong> }
            <p>Recargar cerrará los formularios abiertos. Termina tus cambios y confirma el estado de cualquier pago antes de actualizar.</p>
            <button type="button" [disabled]="!connection.available()" (click)="pwa.reload()">Recargar aplicación</button>
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    .pwa-status { position:fixed; bottom:1rem; left:1rem; z-index:10000; width:min(31rem,calc(100vw - 2rem)); max-height:55vh; overflow:auto; padding:1rem; border:1px solid #b6d6e9; border-left:5px solid #167fb9; border-radius:12px; background:#fff; color:#25324a; box-shadow:0 8px 28px #0002; font:14px/1.5 system-ui,sans-serif; }
    p { margin:.45rem 0; } button,a { display:inline-block; margin:.35rem .6rem .1rem 0; } button { padding:.45rem .75rem; border-radius:7px; border:1px solid #167fb9; background:#167fb9; color:white; cursor:pointer; } button:disabled { opacity:.6; cursor:wait; } a { color:#12638f; text-decoration:underline; } button:focus-visible,a:focus-visible { outline:3px solid #25324a; outline-offset:3px; }
  `],
})
export class PwaStatusComponent {
  readonly connection = inject(ConnectivityService);
  readonly content = inject(PublicContentService);
  readonly pwa = inject(PwaService);
  private readonly router = inject(Router);
  private readonly route = signal(this.router.url);
  readonly copiedAt = computed(() => {
    const paths: Record<string, PublicContentPath> = { '/about': '/about', '/contactanos': '/contact', '/privacidad': '/privacidad', '/terminos': '/terminos' };
    const path = paths[this.route().split(/[?#]/)[0]];
    return path ? (this.connection.available() ? this.content.displayedCopies()[path] : this.content.displayedAt()[path]) : undefined;
  });

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(event => this.route.set(event.urlAfterRedirects));
  }

  async retry(): Promise<void> {
    if (await this.connection.check()) await this.content.prepare();
  }
}
