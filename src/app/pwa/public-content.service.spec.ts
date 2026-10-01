import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api/api.config';
import { ConnectivityService } from './connectivity.service';
import { PublicContentService } from './public-content.service';
import { PUBLIC_CONTENT_STORE, PublicSnapshot } from './public-content.store';
import { pwaInterceptor } from './pwa.interceptor';

describe('Contenido institucional y conectividad', () => {
  let http: HttpTestingController;
  let service: PublicContentService;
  let connection: ConnectivityService;
  let snapshots: Map<string, PublicSnapshot>;
  const about = [{ id_about: 1, type: 'MISION', title: 'Misión', content: 'Contenido público', status: 'Activo' }];

  beforeEach(() => {
    snapshots = new Map();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([pwaInterceptor])), provideHttpClientTesting(),
      { provide: PUBLIC_CONTENT_STORE, useValue: {
        read: async (key: string) => snapshots.get(key),
        write: async (value: PublicSnapshot) => { snapshots.set(value.key, value); },
        remove: async (key: string) => { snapshots.delete(key); },
      } },
    ] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PublicContentService);
    connection = TestBed.inject(ConnectivityService);
    connection.state.set('online');
  });
  afterEach(() => http.verify());

  it('descarga contenido público sin credenciales y lo recupera sin red', async () => {
    const first = service.get('/about');
    const request = http.expectOne(`${API_URL}/about`);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.credentials).toBe('omit');
    request.flush(about);
    expect(await first).toEqual(about);
    expect(snapshots.size).toBe(1);
    connection.state.set('offline');
    expect(await service.get('/about')).toEqual(about);
    expect(service.displayedCopies()['/about']).toBeGreaterThan(0);
    http.expectNone(`${API_URL}/about`);
  });

  it('no descarga catálogo ni permite agregar rutas arbitrarias a la copia pública', async () => {
    await expectAsync(service.get('/catalog' as never)).toBeRejected();
    expect(snapshots.size).toBe(0);
  });

  it('no oculta una respuesta 404 con una copia anterior', async () => {
    snapshots.set(`${API_URL}/about`, { key: `${API_URL}/about`, path: '/about', savedAt: Date.now(), body: about });
    const request = service.get('/about');
    const rejected = expectAsync(request).toBeRejected();
    http.expectOne(`${API_URL}/about`).flush({}, { status: 404, statusText: 'Not found' });
    await rejected;
    expect(snapshots.size).toBe(0);
  });

  it('mantiene el contenido público online aunque no pueda persistirse', async () => {
    TestBed.inject(PUBLIC_CONTENT_STORE).write = async () => { throw new Error('Quota'); };
    const request = service.get('/about');
    http.expectOne(`${API_URL}/about`).flush(about);
    expect(await request).toEqual(about);
    expect(service.storageError()).toBeTrue();
    expect(service.complete()).toBeFalse();
  });

  it('precarga las cuatro páginas sin que el usuario las visite', async () => {
    const preparation = service.prepare();
    http.expectOne(`${API_URL}/about`).flush(about);
    http.expectOne(`${API_URL}/contact`).flush({ estado: 'Activo', direccion: 'Dirección pública' });
    http.expectOne(`${API_URL}/privacidad`).flush([]);
    http.expectOne(`${API_URL}/terminos`).flush({ secciones: [], ultima_actualizacion: null });
    await preparation;
    expect(service.complete()).toBeTrue();
    expect(snapshots.size).toBe(4);
  });

  it('no envía ni reintenta escrituras al estar desconectado', async () => {
    connection.state.set('offline');
    const result = firstValueFrom(TestBed.inject(HttpClient).post(`${API_URL}/payments`, { amount: 10 }));
    await expectAsync(result).toBeRejected();
    http.expectNone(`${API_URL}/payments`);
    connection.state.set('online');
    http.expectNone(`${API_URL}/payments`);
    expect(snapshots.size).toBe(0);
  });

  it('agrupa comprobaciones de conexión y distingue servicio caído de reconexión', async () => {
    const first = connection.check();
    expect(connection.check()).toBe(first);
    http.expectOne(`${API_URL}/health`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await first).toBeFalse();
    expect(connection.state()).toBe('unavailable');
    const second = connection.check();
    http.expectOne(`${API_URL}/health`).flush({ status: 'ok' });
    expect(await second).toBeTrue();
    expect(connection.restored()).toBeTrue();
  });

  it('un error de permisos no cambia la conectividad', () => {
    connection.reportFailure(new HttpErrorResponse({ status: 401 }));
    expect(connection.available()).toBeTrue();
    http.expectNone(`${API_URL}/health`);
  });
});
