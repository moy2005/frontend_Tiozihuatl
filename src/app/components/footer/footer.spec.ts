import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Footer } from './footer';
import { ConnectivityService } from '../../pwa/connectivity.service';
import { pwaInterceptor } from '../../pwa/pwa.interceptor';
import { PUBLIC_CONTENT_STORE, PublicSnapshot } from '../../pwa/public-content.store';
import { API_URL } from '../../api/api.config';

const contact = {
  estado: 'Activo', telefono: '7710000000', correo: 'contacto@example.com',
  horario: 'Lunes a viernes', direccion: 'Dirección institucional',
  facebook: 'https://www.facebook.com/instituto', instagram: 'https://www.instagram.com/instituto',
  twitter: 'https://x.com/instituto', whatsapp: '527710000000',
};

describe('Footer sin conexión', () => {
  let http: HttpTestingController;
  let connection: ConnectivityService;
  let snapshots: Map<string, PublicSnapshot>;
  beforeEach(() => {
    snapshots = new Map();
    TestBed.configureTestingModule({ imports: [Footer], providers: [
      provideRouter([]), provideHttpClient(withInterceptors([pwaInterceptor])), provideHttpClientTesting(),
      { provide: PUBLIC_CONTENT_STORE, useValue: {
        read: async (key: string) => snapshots.get(key),
        write: async (snapshot: PublicSnapshot) => { snapshots.set(snapshot.key, snapshot); },
        remove: async (key: string) => { snapshots.delete(key); },
      } },
    ] });
    http = TestBed.inject(HttpTestingController);
    connection = TestBed.inject(ConnectivityService);
    connection.state.set('online');
  });
  afterEach(() => http.verify());

  it('mantiene diseño, contactos y enlaces; recupera los datos guardados al reabrirse offline', async () => {
    let fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    http.expectOne(`${API_URL}/contact`).flush(contact);
    await fixture.whenStable();
    fixture.detectChanges();
    const onlineText = fixture.nativeElement.textContent;
    const onlineClasses = Array.from(fixture.nativeElement.querySelectorAll('[class]') as NodeListOf<Element>, el => el.className);
    const linkCount = fixture.nativeElement.querySelectorAll('a').length;
    connection.state.set('offline');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe(onlineText);
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(linkCount);
    expect(Array.from(fixture.nativeElement.querySelectorAll('[class]') as NodeListOf<Element>, el => el.className)).toEqual(onlineClasses);
    const links = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>);
    expect(links.find(a => a.textContent?.includes('Quiénes somos'))?.getAttribute('href')).toBe('/about');
    expect(links.find(a => a.textContent?.includes('Catálogo bibliográfico'))?.getAttribute('href')).toBe('/sin-conexion?volver=%2Fcatalogo');
    expect(links.find(a => a.getAttribute('aria-label') === 'Facebook')?.getAttribute('href')).toBe('/sin-conexion');
    fixture.destroy();
    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe(onlineText);
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(linkCount);
    http.expectNone(`${API_URL}/contact`);
    connection.state.set('online');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[aria-label="Facebook"]').getAttribute('href')).toBe(contact.facebook);
  });
});
