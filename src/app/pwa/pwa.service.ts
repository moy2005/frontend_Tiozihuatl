import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, NgZone, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';

@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly updates = inject(SwUpdate);
  private readonly connection = inject(ConnectivityService);
  private readonly content = inject(PublicContentService);
  private readonly destroy = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly started = signal(false);
  readonly assetsReady = signal(false);
  readonly updateReady = signal(false);
  readonly updateError = signal('');
  readonly unsupported = signal(false);
  private lastUpdateCheck = 0;

  constructor() {
    effect(() => {
      if (this.started() && this.connection.available()) untracked(() => {
        void this.content.prepare();
        if (this.assetsReady()) void this.checkForUpdate();
      });
    });
  }

  start(): void {
    if (!this.browser || this.started()) return;
    this.started.set(true);
    if (!this.connection.available()) void this.content.prepare();
    if (!this.updates.isEnabled) return;
    if (!window.isSecureContext || !('serviceWorker' in navigator)) { this.unsupported.set(true); return; }
    const subscription = this.updates.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') { this.updateReady.set(true); this.updateError.set(''); }
      if (event.type === 'VERSION_INSTALLATION_FAILED' || event.type === 'VERSION_FAILED') this.updateError.set('No se pudo descargar la nueva versión. La aplicación volverá a intentarlo con conexión.');
    });
    const unrecoverable = this.updates.unrecoverable.subscribe(() => this.updateError.set('Esta versión necesita recargarse con conexión. Guarda o revisa tus operaciones antes de continuar.'));
    const controlled = () => this.zone.run(() => {
      this.assetsReady.set(!!navigator.serviceWorker.controller);
      if (this.assetsReady()) void this.content.prepareIcons().catch(() => this.content.iconsReady.set(false));
    });
    const visible = () => { if (document.visibilityState === 'visible' && this.connection.available()) void this.checkForUpdate(); };
    navigator.serviceWorker.addEventListener('controllerchange', controlled);
    document.addEventListener('visibilitychange', visible);
    this.zone.runOutsideAngular(() => {
      void navigator.serviceWorker.ready.then(() => { controlled(); void this.checkForUpdate(); });
      const interval = setInterval(visible, 60 * 60 * 1000);
      this.destroy.onDestroy(() => clearInterval(interval));
    });
    this.destroy.onDestroy(() => {
      subscription.unsubscribe();
      unrecoverable.unsubscribe();
      navigator.serviceWorker.removeEventListener('controllerchange', controlled);
      document.removeEventListener('visibilitychange', visible);
    });
  }

  private async checkForUpdate(): Promise<void> {
    if (!this.updates.isEnabled || !this.connection.available() || Date.now() - this.lastUpdateCheck < 60_000) return;
    this.lastUpdateCheck = Date.now();
    try { await this.updates.checkForUpdate(); }
    catch { this.updateError.set('No se pudo comprobar si hay actualizaciones. Se volverá a intentar con conexión.'); }
  }

  reload(): void {
    if (this.browser && this.connection.available()) window.location.reload();
  }
}
