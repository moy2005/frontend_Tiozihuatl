import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';
import { PwaService } from './pwa.service';
import { safeReturnUrl } from './pwa-policy';

@Component({
  selector: 'app-offline-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="offline-page">
      <h1>{{ connection.available() ? 'Información disponible sin conexión' : 'Este servicio necesita conexión' }}</h1>
      <p>El catálogo, los documentos, tu cuenta y los trámites necesitan consultar información actualizada.</p>
      <p>Las operaciones no se enviarán automáticamente al recuperar conexión. Si la conexión se perdió durante un pago o solicitud, consulta su estado antes de repetirlo.</p>
      @if (pwa.assetsReady() && content.complete() && content.iconsReady()) {
        <p role="status">Información institucional descargada. La copia más antigua es del {{ content.oldestCopy() | date:'dd/MM/yyyy HH:mm' }}. Las copias vencen a los 30 días.</p>
      } @else if (content.preparing()) {
        <p role="status">Preparando la información institucional…</p>
      } @else {
        <p role="status">La descarga está incompleta. Las páginas sin copia guardada requieren conexión. El navegador también puede liberar el almacenamiento.</p>
      }
      <nav aria-label="Información institucional">
        <a routerLink="/inicio">Inicio</a>
        <a routerLink="/seguridad">Seguridad</a>
        @if (content.saved()['/about']) { <a routerLink="/about">Nosotros</a> }
        @if (content.saved()['/contact']) { <a routerLink="/contactanos">Contacto</a> }
        @if (content.saved()['/privacidad']) { <a routerLink="/privacidad">Privacidad</a> }
        @if (content.saved()['/terminos']) { <a routerLink="/terminos">Términos</a> }
      </nav>
      <button type="button" (click)="retry()" [disabled]="connection.checking()">{{ connection.checking() ? 'Comprobando conexión…' : 'Reintentar y volver al servicio' }}</button>
    </section>
  `,
  styles: [`
    .offline-page { max-width:850px; min-height:65vh; margin:auto; padding:9rem 1.5rem 5rem; color:#25324a; font-family:system-ui,sans-serif; } h1 { font-size:clamp(1.7rem,4vw,2.5rem); font-weight:800; } p { margin:1rem 0; line-height:1.7; } nav { display:flex; flex-wrap:wrap; gap:.75rem; margin:1.5rem 0; } a,button { border-radius:9px; padding:.7rem 1rem; } a { background:#e7f4fc; color:#12638f; text-decoration:underline; } button { background:#167fb9; color:white; border:0; cursor:pointer; } button:disabled { opacity:.6; }
  `],
})
export class OfflinePageComponent {
  readonly connection = inject(ConnectivityService);
  readonly content = inject(PublicContentService);
  readonly pwa = inject(PwaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  async retry(): Promise<void> {
    if (await this.connection.check()) {
      void this.content.prepare();
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('volver')));
    }
  }
}
