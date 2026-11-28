import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { signal } from '@angular/core';
import { PwaService } from './pwa.service';
import { PublicContentService } from './public-content.service';
import { ConnectivityService } from './connectivity.service';

describe('Actualización de PWA', () => {
  it('deja preparada la nueva versión sin activarla y avisa solo si la sesión queda dañada', () => {
    const events = new Subject<unknown>();
    const unrecoverable = new Subject<unknown>();
    const updates = { isEnabled: true, versionUpdates: events, unrecoverable, checkForUpdate: jasmine.createSpy('checkForUpdate').and.resolveTo(false), activateUpdate: jasmine.createSpy('activateUpdate') };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: SwUpdate, useValue: updates },
      { provide: PublicContentService, useValue: { prepare: async () => undefined, prepareIcons: async () => undefined, iconsReady: signal(false) } },
    ] });
    const pwa = TestBed.inject(PwaService);
    pwa.start();
    events.next({ type: 'VERSION_READY' });
    expect(pwa.recoveryRequired()).toBeFalse();
    expect(updates.activateUpdate).not.toHaveBeenCalled();
    unrecoverable.next({ reason: 'Missing chunk' });
    events.next({ type: 'VERSION_READY' });
    expect(pwa.recoveryRequired()).toBeTrue();
    expect(pwa.assetsReady()).toBeFalse();
  });

  it('conserva la versión instalada si falla una descarga y agrupa comprobaciones en segundo plano', async () => {
    const events = new Subject<unknown>();
    let resolveCheck!: (value: boolean) => void;
    const pending = new Promise<boolean>(resolve => { resolveCheck = resolve; });
    const updates = { isEnabled: true, versionUpdates: events, unrecoverable: new Subject(), checkForUpdate: jasmine.createSpy().and.returnValue(pending) };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: SwUpdate, useValue: updates },
      { provide: ConnectivityService, useValue: { available: signal(true) } },
      { provide: PublicContentService, useValue: { prepare: async () => undefined, prepareIcons: async () => undefined, iconsReady: signal(false) } },
    ] });
    const pwa = TestBed.inject(PwaService);
    pwa.start();
    pwa.assetsReady.set(true);
    events.next({ type: 'VERSION_INSTALLATION_FAILED', version: { hash: 'broken' }, error: 'Hash mismatch' });
    expect(pwa.recoveryRequired()).toBeFalse();
    expect(pwa.assetsReady()).toBeTrue(); // La versión anterior sigue disponible.
    spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);
    resolveCheck(false);
    await pending;
    expect(pwa.assetsReady()).toBeTrue();
    events.next({ type: 'VERSION_FAILED', version: { hash: 'next' }, error: 'Missing asset' });
    expect(pwa.assetsReady()).toBeFalse();
    expect(pwa.recoveryRequired()).toBeFalse();
  });
});
