import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';
import { PwaService } from './pwa.service';
import { PublicContentPath, safeReturnUrl } from './pwa-policy';

@Component({
  selector: 'app-offline-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './offline-page.component.html',
  styleUrl: './offline-page.component.css',
})
export class OfflinePageComponent {
  readonly connection = inject(ConnectivityService);
  readonly content = inject(PublicContentService);
  readonly pwa = inject(PwaService);
  readonly retrying = signal(false);
  readonly retryFailed = signal(false);
  readonly downloaded = computed(() => this.pwa.assetsReady() && this.content.complete() && this.content.iconsReady());
  readonly pages: { title: string; description: string; route: string; icon: string; path?: PublicContentPath }[] = [
    { title: 'Inicio', description: 'Conoce el instituto y su comunidad.', route: '/inicio', icon: '⌂' },
    { title: 'Nosotros', description: 'Nuestra misión, visión y valores.', route: '/about', icon: '◎', path: '/about' },
    { title: 'Contacto', description: 'Dirección, horarios y medios de atención.', route: '/contactanos', icon: '✉', path: '/contact' },
    { title: 'Seguridad', description: 'Recomendaciones para cuidar tu información.', route: '/seguridad', icon: '◇' },
    { title: 'Privacidad', description: 'Cómo se protege tu información personal.', route: '/privacidad', icon: '▤', path: '/privacidad' },
    { title: 'Términos de uso', description: 'Condiciones de nuestros servicios.', route: '/terminos', icon: '≡', path: '/terminos' },
  ];
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  availableOffline(path?: PublicContentPath): boolean {
    return this.pwa.assetsReady() && (!path || !!this.content.saved()[path]);
  }

  async retry(): Promise<void> {
    if (this.retrying()) return;
    this.retrying.set(true);
    this.retryFailed.set(false);
    try {
      if (await this.connection.check()) {
        await this.content.prepare();
        const destination = this.route.snapshot.queryParamMap.get('volver');
        if (destination) await this.router.navigateByUrl(safeReturnUrl(destination));
      } else this.retryFailed.set(true);
    } finally { this.retrying.set(false); }
  }
}
