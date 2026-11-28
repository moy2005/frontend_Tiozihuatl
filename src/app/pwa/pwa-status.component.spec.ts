import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { PwaStatusComponent } from './pwa-status.component';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';
import { PwaService } from './pwa.service';

describe('Avisos PWA', () => {
  it('retira automáticamente el aviso de reconexión', fakeAsync(() => {
    const restored = signal(true);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: ConnectivityService, useValue: { available: signal(true), restored } },
      { provide: PwaService, useValue: { recoveryRequired: signal(false), unsupported: signal(false) } },
      { provide: PublicContentService, useValue: { displayedCopies: signal({}), displayedAt: signal({}), storageError: signal(false) } },
    ] });
    const fixture = TestBed.createComponent(PwaStatusComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pwa-restored')).not.toBeNull();
    tick(4500);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pwa-restored')).toBeNull();
  }));

  it('permite cerrar avisos de almacenamiento y mantiene visible un fallo crítico', () => {
    const pwa = { recoveryRequired: signal(false), unsupported: signal(false) };
    const storageError = signal(true);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: PwaService, useValue: pwa },
      { provide: ConnectivityService, useValue: { available: signal(true), state: signal('online'), restored: signal(false), checking: signal(false) } },
      { provide: PublicContentService, useValue: { displayedCopies: signal({}), displayedAt: signal({}), storageError } },
    ] });
    const fixture = TestBed.createComponent(PwaStatusComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Descarga incompleta');
    fixture.nativeElement.querySelector('.pwa-notice__close').click();
    fixture.detectChanges();
    expect(component.visibleNotices().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Ver avisos (1)');
    fixture.nativeElement.querySelector('.pwa-notifications__restore').click();
    fixture.detectChanges();
    expect(component.visibleNotices().length).toBe(1);
    component.dismiss(component.notices()[0]);
    storageError.set(false);
    pwa.recoveryRequired.set(true);
    fixture.detectChanges();
    component.dismiss(component.notices()[0]);
    expect(component.visibleNotices()[0].closable).toBeFalse();
    expect(fixture.nativeElement.querySelector('.pwa-notice__close')).toBeNull();
  });
});
