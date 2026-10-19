import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConnectivityService } from './connectivity.service';
import { NotificacionesService } from '../api/services/notificaciones.service';
import { SwPush } from '@angular/service-worker';

describe('Solicitudes durante desconexión', () => {
  let http: HttpTestingController;
  let online: jasmine.Spy;
  beforeEach(() => {
    online = spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: SwPush, useValue: { isEnabled: false } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('no consulta health ni la campana mientras el navegador informa offline', async () => {
    const connection = TestBed.inject(ConnectivityService);
    expect(await connection.check()).toBeFalse();
    expect(connection.state()).toBe('offline');
    expect(connection.confirmed()).toBeTrue();
    const inbox = TestBed.inject(NotificacionesService);
    inbox.attach();
    await inbox.refresh();
    await inbox.refreshCount();
    inbox.detach();
    http.expectNone(() => true);
  });

  it('ignora una respuesta de health anterior a la pérdida de red', async () => {
    online.and.returnValue(true);
    const connection = TestBed.inject(ConnectivityService);
    const first = connection.check();
    const request = http.expectOne(r => r.url.endsWith('/health'));
    online.and.returnValue(false);
    await connection.check();
    request.flush({ status: 'ok' });
    await first;
    expect(connection.state()).toBe('offline');
    expect(connection.restored()).toBeFalse();
  });
});
