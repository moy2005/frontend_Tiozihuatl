import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { PwaStatusComponent } from './pwa-status.component';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';
import { PwaService } from './pwa.service';

describe('Avisos PWA', () => {
  it('permite posponer y recuperar avisos sin ocultar un fallo crítico ni otra versión', () => {
    const pwa = { updateReady: signal(true), readyVersion: signal('v1'), updateError: signal(''), recoveryRequired: signal(false), unsupported: signal(false), checkingUpdate: signal(false) };
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: PwaService, useValue: pwa },
      { provide: ConnectivityService, useValue: { available: signal(true), state: signal('online'), restored: signal(false), checking: signal(false) } },
      { provide: PublicContentService, useValue: { displayedCopies: signal({}), displayedAt: signal({}), storageError: signal(false) } },
    ] });
    const fixture = TestBed.createComponent(PwaStatusComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Hay mejoras listas para ti');
    fixture.nativeElement.querySelector('.pwa-notice__close').click();
    fixture.detectChanges();
    expect(component.visibleNotices().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Ver avisos (1)');
    fixture.nativeElement.querySelector('.pwa-notifications__restore').click();
    fixture.detectChanges();
    expect(component.visibleNotices().length).toBe(1);
    component.dismiss(component.notices()[0]);
    pwa.readyVersion.set('v2');
    fixture.detectChanges();
    expect(component.visibleNotices()[0].key).toBe('update:v2');
    pwa.recoveryRequired.set(true);
    pwa.updateError.set('Recarga necesaria');
    fixture.detectChanges();
    component.dismiss(component.notices()[0]);
    expect(component.visibleNotices()[0].closable).toBeFalse();
    expect(fixture.nativeElement.querySelector('.pwa-notice__close')).toBeNull();
  });
});
