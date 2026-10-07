import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { signal } from '@angular/core';
import { PwaService } from './pwa.service';
import { PublicContentService } from './public-content.service';

describe('Actualización de PWA', () => {
  it('avisa cuando hay nueva versión o un error, sin activación automática', () => {
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
    expect(pwa.updateReady()).toBeTrue();
    expect(updates.activateUpdate).not.toHaveBeenCalled();
    unrecoverable.next({ reason: 'Missing chunk' });
    expect(pwa.updateError()).toContain('recargarse');
    events.next({ type: 'NO_NEW_VERSION_DETECTED' });
    expect(pwa.recoveryRequired()).toBeTrue();
    expect(pwa.updateError()).toContain('recargarse');
  });

  it('limpia errores recuperables y agrupa comprobaciones simultáneas', async () => {
    const events = new Subject<unknown>();
    let resolveCheck!: (value: boolean) => void;
    const pending = new Promise<boolean>(resolve => { resolveCheck = resolve; });
    const updates = { isEnabled: true, versionUpdates: events, unrecoverable: new Subject(), checkForUpdate: jasmine.createSpy().and.returnValue(pending) };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: SwUpdate, useValue: updates },
      { provide: PublicContentService, useValue: { prepare: async () => undefined, prepareIcons: async () => undefined, iconsReady: signal(false) } },
    ] });
    const pwa = TestBed.inject(PwaService);
    pwa.start();
    events.next({ type: 'VERSION_INSTALLATION_FAILED', version: { hash: 'broken' }, error: 'Hash mismatch' });
    expect(pwa.updateError()).not.toBe('');
    const check = pwa.checkForUpdate(true);
    await pwa.checkForUpdate(true);
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);
    resolveCheck(false);
    await check;
    expect(pwa.updateError()).toBe('');
    expect(pwa.checkingUpdate()).toBeFalse();
    events.next({ type: 'VERSION_READY', latestVersion: { hash: 'next' } });
    events.next({ type: 'VERSION_FAILED', version: { hash: 'next' }, error: 'Missing asset' });
    expect(pwa.updateReady()).toBeFalse();
  });
});
