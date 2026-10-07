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
  readonly recoveryRequired = signal(false);
  readonly readyVersion = signal('');
  readonly checkingUpdate = signal(false);
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
      if (event.type === 'VERSION_READY') {
        this.readyVersion.set(event.latestVersion?.hash || 'ready');
        this.updateReady.set(true);
        if (!this.recoveryRequired()) this.updateError.set('');
      }
      if (event.type === 'NO_NEW_VERSION_DETECTED' && !this.recoveryRequired()) this.updateError.set('');
      if (event.type === 'VERSION_INSTALLATION_FAILED' || event.type === 'VERSION_FAILED') {
        console.warn('[PWA]', event.type, event.version.hash, event.error);
        if (event.version.hash === this.readyVersion()) { this.updateReady.set(false); this.readyVersion.set(''); }
        if (!this.recoveryRequired()) this.updateError.set('No pudimos preparar la actualización. Puedes seguir usando la página y volver a comprobarla más tarde.');
      }
    });
    const unrecoverable = this.updates.unrecoverable.subscribe(event => {
      console.warn('[PWA] UNRECOVERABLE', event.reason);
      this.recoveryRequired.set(true);
      this.updateError.set('Esta versión necesita recargarse con conexión. Guarda o revisa tus operaciones antes de continuar.');
    });
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

  async checkForUpdate(manual = false): Promise<void> {
    if (!this.updates.isEnabled || !this.connection.available() || this.checkingUpdate() || (!manual && Date.now() - this.lastUpdateCheck < 60_000)) return;
    this.checkingUpdate.set(true);
    this.lastUpdateCheck = Date.now();
    try {
      await this.updates.checkForUpdate();
      if (!this.recoveryRequired()) this.updateError.set('');
    }
    catch (error) {
      console.warn('[PWA] CHECK_FAILED', error);
      if (!this.recoveryRequired()) this.updateError.set('No pudimos comprobar la actualización. La página seguirá abierta; vuelve a intentarlo más tarde.');
    }
    finally { this.checkingUpdate.set(false); }
  }

  reload(): void {
    if (this.browser && this.connection.available()) window.location.reload();
  }
}
