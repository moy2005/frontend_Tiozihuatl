import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { CONTENT_MAX_AGE } from './pwa-policy';

/**
 * Copia de Inicio para consultarla sin conexión: las noticias y el evento destacado
 * públicos, más sus imágenes principales en versión reducida.
 *
 * Igual que el resto del contenido offline, vive en IndexedDB (no en la caché del
 * service worker, que por política no guarda respuestas de la API ni recursos
 * remotos), se renueva cada vez que Inicio carga con conexión y vence a los 30 días.
 */
export interface NoticiaGuardada {
  id_noticia: number;
  titulo: string;
  contenido: string;
  imagen_url: string | null;
  video_url: string | null;
  categoria: string | null;
  fecha_publicacion: string | null;
  aspectRatio: number | null;
}

export interface EventoGuardado {
  id_evento: number;
  titulo: string;
  descripcion: string | null;
  tipo: string | null;
  ubicacion: string | null;
  enlace: string | null;
  fecha_inicio: string | null;
  imagen: string | null;
}

export interface CopiaInicio {
  savedAt: number;
  noticias: NoticiaGuardada[];
  evento: EventoGuardado | null;
  /** URL original → URL local (blob:) de las imágenes guardadas. */
  imagenes: Map<string, string>;
}

interface RegistroDatos {
  key: 'inicio';
  savedAt: number;
  noticias: NoticiaGuardada[];
  evento: EventoGuardado | null;
}

interface RegistroImagen {
  url: string;
  savedAt: number;
  blob: Blob;
}

const MAX_NOTICIAS = 12;
const MAX_IMAGEN = 2 * 1024 * 1024;
const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;

@Injectable({ providedIn: 'root' })
export class HomeOfflineService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private database?: Promise<IDBDatabase>;
  private guardando?: Promise<void>;

  /** Guarda la copia de Inicio con lo que se acaba de mostrar con conexión. */
  guardar(noticias: unknown[], evento: unknown | null, imagenEvento: string | null): Promise<void> {
    if (!this.browser || typeof indexedDB === 'undefined') return Promise.resolve();
    if (this.guardando) return this.guardando;
    this.guardando = this.escribir(noticias, evento, imagenEvento)
      .catch(() => undefined)
      .finally(() => { this.guardando = undefined; });
    return this.guardando;
  }

  /** Lee la copia vigente; `null` si no hay o ya venció. */
  async leer(): Promise<CopiaInicio | null> {
    if (!this.browser || typeof indexedDB === 'undefined') return null;
    try {
      const db = await this.abrir();
      const datos = await this.pedir<RegistroDatos | undefined>(db, 'datos', 'inicio');
      if (!datos || !Number.isFinite(datos.savedAt) || Date.now() - datos.savedAt > CONTENT_MAX_AGE) return null;
      const registros = await this.todas<RegistroImagen>(db, 'imagenes');
      const imagenes = new Map<string, string>();
      for (const registro of registros) {
        if (registro.blob instanceof Blob) imagenes.set(registro.url, URL.createObjectURL(registro.blob));
      }
      return {
        savedAt: datos.savedAt,
        noticias: Array.isArray(datos.noticias) ? datos.noticias : [],
        evento: datos.evento ?? null,
        imagenes,
      };
    } catch {
      return null;
    }
  }

  /** Libera las URL locales creadas al leer una copia. */
  liberar(copia: CopiaInicio | null): void {
    copia?.imagenes.forEach((local) => URL.revokeObjectURL(local));
  }

  private async escribir(noticias: unknown[], evento: unknown | null, imagenEvento: string | null): Promise<void> {
    const listas = noticias.map(normalizarNoticia).filter((n): n is NoticiaGuardada => !!n).slice(0, MAX_NOTICIAS);
    const destacado = normalizarEvento(evento, imagenEvento);
    const db = await this.abrir();
    await this.poner(db, 'datos', { key: 'inicio', savedAt: Date.now(), noticias: listas, evento: destacado } satisfies RegistroDatos);

    // Imágenes: la del evento y las de las noticias, en versión reducida.
    const urls = [destacado?.imagen, ...listas.map((n) => n.imagen_url)]
      .filter((url): url is string => !!url && /^https:\/\//.test(url));
    const unicas = [...new Set(urls)];
    const existentes = new Set((await this.todas<RegistroImagen>(db, 'imagenes')).map((r) => r.url));

    for (const url of unicas) {
      if (existentes.has(url)) continue;
      try {
        const respuesta = await fetch(versionReducida(url), {
          mode: 'cors',
          credentials: 'omit',
          signal: AbortSignal.timeout(15_000),
        });
        const tipo = respuesta.headers.get('content-type') ?? '';
        if (!respuesta.ok || !tipo.startsWith('image/')) continue;
        const blob = await respuesta.blob();
        if (blob.size > MAX_IMAGEN) continue;
        await this.poner(db, 'imagenes', { url, savedAt: Date.now(), blob } satisfies RegistroImagen);
      } catch {
        // Sin esa imagen la tarjeta muestra su marcador; el resto de la copia sigue siendo útil.
      }
    }

    // Se borran las imágenes de noticias o eventos que ya no están en Inicio.
    for (const url of existentes) {
      if (!unicas.includes(url)) await this.borrar(db, 'imagenes', url).catch(() => undefined);
    }
  }

  private abrir(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    this.database = new Promise<IDBDatabase>((resolve, reject) => {
      // Versión 2: crea las tablas que falten, por si una creación anterior quedó
      // interrumpida y la base existe vacía (con ella la copia nunca se guardaría).
      const request = indexedDB.open('tiozihuatl-inicio', 2);
      const timer = setTimeout(() => reject(new Error('Almacenamiento no disponible')), 3_000);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('datos')) db.createObjectStore('datos', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('imagenes')) db.createObjectStore('imagenes', { keyPath: 'url' });
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        request.result.onversionchange = () => { request.result.close(); this.database = undefined; };
        resolve(request.result);
      };
      request.onerror = () => { clearTimeout(timer); reject(request.error); };
      request.onblocked = () => { clearTimeout(timer); reject(new Error('Almacenamiento bloqueado')); };
    }).catch((error) => { this.database = undefined; throw error; });
    return this.database;
  }

  private pedir<T>(db: IDBDatabase, store: string, key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  private todas<T>(db: IDBDatabase, store: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private poner(db: IDBDatabase, store: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private borrar(db: IDBDatabase, store: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

/** Pide a Cloudinary una versión más ligera (máx. 900 px, calidad automática). */
function versionReducida(url: string): string {
  return CLOUDINARY.test(url) ? url.replace(/\/image\/upload\//, '/image/upload/w_900,c_limit,q_auto,f_jpg/') : url;
}

const texto = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function normalizarNoticia(value: unknown): NoticiaGuardada | null {
  if (!value || typeof value !== 'object') return null;
  const n = value as Record<string, unknown>;
  if (typeof n['id_noticia'] !== 'number' || typeof n['titulo'] !== 'string') return null;
  const ratio = n['aspectRatio'];
  return {
    id_noticia: n['id_noticia'],
    titulo: n['titulo'],
    contenido: texto(n['contenido']) ?? '',
    imagen_url: texto(n['imagen_url']),
    // Los videos no se guardan: pesan demasiado para una copia offline.
    video_url: null,
    categoria: texto(n['categoria']),
    fecha_publicacion: texto(n['fecha_publicacion']),
    aspectRatio: typeof ratio === 'number' && Number.isFinite(ratio) ? ratio : null,
  };
}

function normalizarEvento(value: unknown, imagen: string | null): EventoGuardado | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as Record<string, unknown>;
  if (typeof e['id_evento'] !== 'number' || typeof e['titulo'] !== 'string') return null;
  return {
    id_evento: e['id_evento'],
    titulo: e['titulo'],
    descripcion: texto(e['descripcion']),
    tipo: texto(e['tipo']),
    ubicacion: texto(e['ubicacion']),
    enlace: texto(e['enlace']),
    fecha_inicio: texto(e['fecha_inicio']),
    imagen,
  };
}
