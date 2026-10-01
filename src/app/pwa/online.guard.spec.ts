import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { ConnectivityService } from './connectivity.service';
import { onlineGuard } from './online.guard';

describe('Acceso a rutas sin conexión', () => {
  it('bloquea catálogo y pagos antes de activar sus componentes', () => {
    const offlineRoute = {};
    const router = { createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue(offlineRoute) };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: router }] });
    TestBed.inject(ConnectivityService).state.set('offline');
    for (const url of ['/catalogo', '/checkout', '/admin/usuarios']) {
      const result = TestBed.runInInjectionContext(() => onlineGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
      expect(result as unknown).toBe(offlineRoute);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/sin-conexion'], { queryParams: { volver: url } });
    }
    const publicPage = TestBed.runInInjectionContext(() => onlineGuard({} as ActivatedRouteSnapshot, { url: '/about' } as RouterStateSnapshot));
    expect(publicPage).toBeTrue();
  });
});
