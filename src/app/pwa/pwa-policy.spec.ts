import { API_URL } from '../api/api.config';
import { allowsOffline, CONTENT_MAX_AGE, publicContentPath, safeReturnUrl } from './pwa-policy';
import { usableSnapshot } from './public-content.store';

describe('Política de información offline', () => {
  it('limita las respuestas guardadas al origen y rutas públicas exactas', () => {
    expect(publicContentPath(`${API_URL}/about`)).toBe('/about');
    for (const path of ['/about/admin', '/about?user=1', '/catalog', '/auth/refresh', '/contact/admin', '/users']) expect(publicContentPath(`${API_URL}${path}`)).toBeNull();
    expect(publicContentPath('https://example.com/api/about')).toBeNull();
  });
  it('permite información institucional y excluye operaciones y documentos', () => {
    for (const path of ['/about', '/inicio', '/contactanos', '/privacidad', '/terminos', '/seguridad', '/sin-conexion']) expect(allowsOffline(path)).toBeTrue();
    for (const path of ['/catalogo', '/checkout', '/perfil', '/admin/about', '/biblioteca/libro/1', '/my-loans']) expect(allowsOffline(path)).toBeFalse();
  });
  it('rechaza copias vencidas, futuras o de otro contenido', () => {
    const now = Date.now();
    const snapshot = { key: `${API_URL}/about`, path: '/about' as const, savedAt: now, body: [] };
    expect(usableSnapshot(snapshot, '/about', now)).toBeTrue();
    expect(usableSnapshot(snapshot, '/about', now + CONTENT_MAX_AGE + 1)).toBeFalse();
    expect(usableSnapshot(snapshot, '/about', now - 1)).toBeFalse();
    expect(usableSnapshot(snapshot, '/terminos', now)).toBeFalse();
    expect(usableSnapshot({ ...snapshot, body: { token: 'private' } }, '/about', now)).toBeFalse();
  });
  it('solo admite destinos internos al reconectar', () => {
    expect(safeReturnUrl('/catalogo?search=libro')).toBe('/catalogo?search=libro');
    for (const path of ['https://example.com', '//example.com', '/\\example.com', '/sin-conexion', null]) expect(safeReturnUrl(path)).toBe('/inicio');
  });
});
