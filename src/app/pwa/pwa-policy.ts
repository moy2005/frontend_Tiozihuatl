import { API_URL } from '../api/api.config';

export const PUBLIC_CONTENT_PATHS = ['/about', '/contact', '/privacidad', '/terminos'] as const;
export type PublicContentPath = typeof PUBLIC_CONTENT_PATHS[number];
export const CONTENT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export const OFFLINE_ROUTES = new Set(['/', '/inicio', '/about', '/contactanos', '/seguridad', '/privacidad', '/terminos', '/sin-conexion', '/error-400', '/error-404', '/error-500']);

export function apiPath(url: string): string | null {
  const base = API_URL.replace(/\/$/, '');
  return url.startsWith(`${base}/`) ? url.slice(base.length) : null;
}

export function publicContentPath(url: string): PublicContentPath | null {
  const path = apiPath(url);
  return PUBLIC_CONTENT_PATHS.includes(path as PublicContentPath) ? path as PublicContentPath : null;
}

export function allowsOffline(url: string): boolean {
  return OFFLINE_ROUTES.has(url.split(/[?#;]/)[0].replace(/\/$/, '') || '/');
}

export function safeReturnUrl(value: string | null): string {
  return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) && !value.startsWith('/sin-conexion') ? value : '/inicio';
}

export function validPublicContent(path: PublicContentPath, value: unknown): boolean {
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  if (path === '/about') return Array.isArray(value) && value.every(item => object(item) && typeof item['title'] === 'string' && typeof item['content'] === 'string' && ['MISION', 'VISION', 'VALORES'].includes(String(item['type'])));
  if (path === '/privacidad') return Array.isArray(value) && value.every(item => object(item) && typeof item['titulo'] === 'string' && typeof item['contenido'] === 'string');
  if (path === '/terminos') return object(value) && Array.isArray(value['secciones']) && value['secciones'].every(item => object(item) && typeof item['titulo'] === 'string' && typeof item['contenido'] === 'string');
  return object(value) && (Object.keys(value).length === 0 || typeof value['estado'] === 'string');
}
