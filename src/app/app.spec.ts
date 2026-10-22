import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { App } from './app';
import { ConnectivityService, ConnectionState } from './pwa/connectivity.service';
import { PwaService } from './pwa/pwa.service';
import { PushNotificationService } from './pwa/push-notification.service';
import { AuthService } from './api/services/auth';
import { onlineGuard } from './pwa/online.guard';

@Component({ standalone: true, template: '<p>Contenido de la página</p>' })
class TestPage {}

describe('Navegación al perder conexión', () => {
  const state = signal<ConnectionState>('online');
  let pendingAbout: Promise<boolean> | undefined;
  let router: Router;

  beforeEach(() => {
    state.set('online');
    pendingAbout = undefined;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([{ path: '', canActivateChild: [onlineGuard], children: [
          { path: 'about', component: TestPage, canActivate: [() => pendingAbout ?? true] },
          ...['inicio', 'contactanos', 'seguridad', 'privacidad', 'terminos', 'catalogo', 'sin-conexion'].map(path => ({ path, component: TestPage })),
        ] }]),
        { provide: ConnectivityService, useValue: { available: computed(() => state() === 'online'), start: () => {} } },
        { provide: PwaService, useValue: { start: () => {} } },
        { provide: PushNotificationService, useValue: { start: () => {}, syncSession: async () => {} } },
        { provide: AuthService, useValue: { getSessionUserId: () => null, registerSessionActivity: () => {} } },
      ],
    }).overrideComponent(App, { set: { template: '<router-outlet />', imports: [RouterOutlet] } });
    router = TestBed.inject(Router);
  });

  for (const url of ['/about?origen=footer#valores', '/inicio', '/contactanos', '/seguridad', '/privacidad', '/terminos']) {
    it(`conserva ${url} y su componente al desconectarse`, async () => {
      await router.navigateByUrl(url);
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      await fixture.whenStable();
      const page = fixture.nativeElement.querySelector('p');
      state.set('offline');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(router.url).toBe(url);
      expect(fixture.nativeElement.querySelector('p')).toBe(page);
    });
  }

  it('sale del catálogo y conserva el destino para reintentar', async () => {
    await router.navigateByUrl('/catalogo?materia=1');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    state.set('offline');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.parseUrl(router.url).root.children['primary'].segments[0].path).toBe('sin-conexion');
    expect(router.parseUrl(router.url).queryParams['volver']).toBe('/catalogo?materia=1');
  });

  it('no redirige por la ruta anterior mientras se abre Quiénes somos', async () => {
    await router.navigateByUrl('/catalogo');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    let finish!: (allowed: boolean) => void;
    pendingAbout = new Promise(resolve => { finish = resolve; });
    const navigation = router.navigateByUrl('/about');
    await new Promise(resolve => setTimeout(resolve, 0));
    state.set('offline');
    fixture.detectChanges();
    expect(router.currentNavigation()?.extractedUrl.toString()).toBe('/about');
    finish(true);
    await navigation;
    await fixture.whenStable();
    expect(router.url).toBe('/about');
  });

  it('permite abrir información pública estando ya offline y bloquea catálogo', async () => {
    state.set('offline');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await router.navigateByUrl('/about');
    await fixture.whenStable();
    expect(router.url).toBe('/about');
    await router.navigateByUrl('/catalogo');
    await fixture.whenStable();
    expect(router.url).toContain('/sin-conexion?volver=');
  });
});
