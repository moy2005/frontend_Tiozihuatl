import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
  inject,
  effect,
  untracked,
} from '@angular/core';
import { ConnectivityService } from '../../pwa/connectivity.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { NewsService } from '../../api/services/news.service';
import { EventsService } from '../../api/services/events.service';
import { TextoEnlazadoComponent } from '../../components/texto-enlazado/texto-enlazado';
import { CopiaInicio, HomeOfflineService } from '../../pwa/home-offline.service';

type NewsMediaKind = 'landscape' | 'portrait' | 'square' | 'no-media';

interface NoticiaHome {
  id_noticia: number;
  titulo: string;
  contenido: string;
  imagen_url?: string | null;
  video_url?: string | null;
  categoria?: string | null;
  fecha_publicacion?: string | null;
}

interface NoticiaDetectada extends NoticiaHome {
  mediaKind: NewsMediaKind;
  aspectRatio: number | null;
}

interface AccesoInicio {
  nombre: string;
  descripcion: string;
  ruta: string;
  icono: string;
  color: string;
}

interface GrupoAccesos {
  titulo: string;
  requiereSesion: boolean;
  accesos: AccesoInicio[];
}

interface EventoHomeImagen {
  url: string;
  orden?: number | null;
}

interface EventoHome {
  id_evento: number;
  titulo: string;
  descripcion?: string | null;
  tipo?: 'PRESENCIAL' | 'VIRTUAL' | string | null;
  ubicacion?: string | null;
  enlace?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  imagen_principal?: string | null;
  imagenes?: EventoHomeImagen[];
  destacado?: boolean | number | string;
}

/** Papel del mural que entra con el scroll: tramo de la línea de tiempo y desde dónde llega. */
interface PapelEntrante {
  element: HTMLElement;
  start: number;
  length: number;
  dx: number;
  dy: number;
  dr: number;
}

// Colores de papel de las fichas: amarillo, celeste, rosa, verde y blanco.
const PAPEL = {
  amarillo: '#fff3a6',
  celeste: '#d8efff',
  rosa: '#ffe3df',
  verde: '#e3f5e6',
  blanco: '#fffdf8',
};

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule, TextoEnlazadoComponent],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class InicioComponent implements AfterViewInit, OnDestroy {
  readonly connection = inject(ConnectivityService);
  private readonly copiaInicio = inject(HomeOfflineService);
  @ViewChild('brandSentinel') brandSentinel!: ElementRef<HTMLElement>;
  @ViewChild('brandLogo') brandLogo!: ElementRef<HTMLElement>;
  @ViewChild('brandName') brandName!: ElementRef<HTMLElement>;
  @ViewChild('brandNameSub') brandNameSub!: ElementRef<HTMLElement>;
  @ViewChild('brandCover') brandCover!: ElementRef<HTMLElement>;
  @ViewChild('scrollHint') scrollHint!: ElementRef<HTMLElement>;
  @ViewChildren('revealItem') revealItems!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('enterItem') enterItems!: QueryList<ElementRef<HTMLElement>>;

  noticias: NoticiaDetectada[] = [];
  // Los estados iniciales de las animaciones solo se activan cuando el JS ya
  // corre: si algo falla, el contenido queda visible.
  movimientoListo = false;
  readonly reducirMovimiento =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Fichas del pie del tablero en la portada.
  readonly accesosRapidos: AccesoInicio[] = [
    { nombre: 'Biblioteca', descripcion: '', ruta: '/catalogo', icono: 'ph-books', color: PAPEL.blanco },
    { nombre: 'Calendario', descripcion: '', ruta: '/calendario', icono: 'ph-calendar-blank', color: PAPEL.rosa },
    { nombre: 'Eventos', descripcion: '', ruta: '/eventos', icono: 'ph-calendar-star', color: PAPEL.verde },
    { nombre: 'Contáctanos', descripcion: '', ruta: '/contactanos', icono: 'ph-envelope-simple', color: PAPEL.amarillo },
  ];

  // Secciones del instituto: solo rutas que ya existen en el sistema.
  readonly gruposAccesos: GrupoAccesos[] = [
    {
      titulo: 'Para todos',
      requiereSesion: false,
      accesos: [
        { nombre: 'Noticias', descripcion: 'Avisos, convocatorias e inscripciones', ruta: '/noticias', icono: 'ph-newspaper', color: PAPEL.blanco },
        { nombre: 'Eventos', descripcion: 'Congresos y actividades del instituto', ruta: '/eventos', icono: 'ph-calendar-star', color: PAPEL.verde },
        { nombre: 'Calendario escolar', descripcion: 'Fechas y periodos del ciclo escolar', ruta: '/calendario', icono: 'ph-calendar-blank', color: PAPEL.rosa },
        { nombre: 'Quiénes somos', descripcion: 'Misión, visión y valores', ruta: '/about', icono: 'ph-users-three', color: PAPEL.celeste },
        { nombre: 'Contáctanos', descripcion: 'Escríbenos y resuelve tus dudas', ruta: '/contactanos', icono: 'ph-envelope-simple', color: PAPEL.amarillo },
      ],
    },
    {
      titulo: 'Con tu cuenta',
      requiereSesion: true,
      accesos: [
        { nombre: 'Biblioteca', descripcion: 'Catálogo de libros y préstamos', ruta: '/catalogo', icono: 'ph-books', color: PAPEL.blanco },
        { nombre: 'Tienda', descripcion: 'Revistas para consultar y adquirir', ruta: '/magazines', icono: 'ph-book-open-text', color: PAPEL.celeste },
        { nombre: 'Materiales', descripcion: 'Materiales de estudio por materia', ruta: '/materiales', icono: 'ph-folder-simple', color: PAPEL.amarillo },
      ],
    },
  ];

  // Inicio muestra un único evento destacado: el primero marcado como tal.
  eventoDestacado: EventoHome | null = null;
  // Pila de fotos del evento: avanza sola al terminar la barra del punto activo
  // (CSS la pausa al pasar el puntero o enfocar) y se detiene al usarla a mano.
  imagenesDestacado: string[] = [];
  imagenActiva = 0;
  carruselAutomatico = false;
  // Flyer de la portada: su proporción real define el tamaño del papel; mientras
  // la imagen llega, el hueco (proporción 0.7) respira igual que en noticias.
  flyerProporcion: number | null = null;
  // Sin conexión, Inicio muestra la última copia guardada; aquí queda su fecha
  // (null cuando los datos son en vivo o no hay copia).
  copiaOffline: number | null = null;
  private copiaActual: CopiaInicio | null = null;
  flyerCargado = false;
  flyerError = false;
  private inicioDeslizamiento: { x: number; y: number } | null = null;
  cargandoNoticias = true;
  cargandoEventos = true;

  private scrollRafId = 0;
  private resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  // Centro y ancho del logo relativos al contenedor sticky (sin transformar).
  private logoOrigin?: { x: number; y: number; width: number };
  // Progreso mostrado: sigue al del scroll con un suavizado exponencial.
  private brandProgress = -1;
  private lastBrandFrame = 0;
  private papeles: PapelEntrante[] = [];
  private revealObserver?: IntersectionObserver;
  private subs: Subscription[] = [];

  constructor(
    private newsService: NewsService,
    private eventsService: EventsService,
    private ngZone: NgZone
  ) {
    effect(() => {
      const available = this.connection.available();
      untracked(() => {
        if (available) void this.cargarEnLinea();
        else void this.cargarCopia();
      });
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.medirLogoInicial();
        this.leerPapeles();
        window.addEventListener('scroll', this.onBrandScroll, { passive: true });
        window.addEventListener('resize', this.onBrandResize, { passive: true });
        this.inicializarRevelados();
        this.subs.push(
          this.enterItems.changes.subscribe(() => requestAnimationFrame(() => {
            this.leerPapeles();
            this.brandProgress = -1;
            this.programarBrandFrame();
          }))
        );
        this.programarBrandFrame();
        if (typeof IntersectionObserver !== 'undefined') {
          this.ngZone.run(() => { this.movimientoListo = true; });
        }
      });
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onBrandScroll);
    window.removeEventListener('resize', this.onBrandResize);
    cancelAnimationFrame(this.scrollRafId);
    this.scrollRafId = 0;
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.revealObserver?.disconnect();
    this.subs.forEach((s) => s.unsubscribe());
    this.copiaInicio.liberar(this.copiaActual);
  }

  // ── Intro y portada ligadas al scroll ─────────────────────────────

  private onBrandScroll = (): void => this.programarBrandFrame();

  private onBrandResize = (): void => {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.medirLogoInicial();
      this.brandProgress = -1;
      this.programarBrandFrame();
    }, 120);
  };

  private programarBrandFrame(): void {
    if (this.scrollRafId) return;
    this.scrollRafId = requestAnimationFrame(this.brandFrame);
  }

  // Un solo bucle rAF: avanza el progreso mostrado hacia el del scroll y se
  // detiene al alcanzarlo. Suaviza los saltos de la rueda del ratón y del
  // cambio de altura de la barra del navegador móvil (dvh).
  private brandFrame = (now: number): void => {
    this.scrollRafId = 0;
    const target = this.calcularProgresoBrand();
    if (target === null) return;

    if (this.brandProgress < 0 || this.reducirMovimiento) {
      this.brandProgress = target;
    } else {
      const dt = this.lastBrandFrame ? Math.min(64, now - this.lastBrandFrame) : 16;
      this.brandProgress += (target - this.brandProgress) * (1 - Math.exp(-dt / 90));
      if (Math.abs(target - this.brandProgress) < 0.0005) this.brandProgress = target;
    }

    this.actualizarBrandHero(this.brandProgress);
    if (this.brandProgress !== target) {
      this.lastBrandFrame = now;
      this.programarBrandFrame();
    } else {
      this.lastBrandFrame = 0;
    }
  };

  private medirLogoInicial(): void {
    const logo = this.brandLogo?.nativeElement;
    const sticky = this.brandSentinel?.nativeElement.querySelector('.home-brand-sticky');
    if (!logo || !sticky) return;

    logo.style.transform = 'none';
    logo.style.opacity = '1';
    logo.style.visibility = 'visible';
    const rect = logo.getBoundingClientRect();
    const base = sticky.getBoundingClientRect();
    this.logoOrigin = {
      x: rect.left + rect.width / 2 - base.left,
      y: rect.top + rect.height / 2 - base.top,
      width: rect.width,
    };
  }

  /** Lee una sola vez el tramo de entrada de cada papel (data-enter="inicio duración dx dy giro"). */
  private leerPapeles(): void {
    this.papeles = (this.enterItems?.toArray() ?? []).map(({ nativeElement }) => {
      const [start, length, dx, dy, dr] = (nativeElement.dataset['enter'] ?? '0 1 0 0 0')
        .split(/\s+/)
        .map(Number);
      return { element: nativeElement, start, length, dx, dy, dr };
    });
  }

  private calcularProgresoBrand(): number | null {
    const sentinel = this.brandSentinel?.nativeElement;
    if (!sentinel) return null;

    const scrollY = window.scrollY;
    const sentinelTop = sentinel.getBoundingClientRect().top + scrollY;
    const stickyHeight =
      (sentinel.querySelector('.home-brand-sticky') as HTMLElement | null)?.clientHeight ||
      window.innerHeight;
    const scrollEnd = sentinelTop + sentinel.offsetHeight - stickyHeight;
    const rawProgress = scrollEnd <= sentinelTop
      ? (scrollY > sentinelTop ? 1 : 0)
      : (scrollY - sentinelTop) / (scrollEnd - sentinelTop);
    return Math.min(1, Math.max(0, rawProgress));
  }

  // Centro del destino sin las traslaciones CSS en curso del navbar, para que
  // su transición de entrada no desplace el punto de llegada del logo.
  private centroSinTraslacion(element: HTMLElement): { x: number; y: number; width: number } {
    const rect = element.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    for (let node: HTMLElement | null = element, depth = 0; node && depth < 2; node = node.parentElement, depth++) {
      const transform = getComputedStyle(node).transform;
      if (!transform || transform === 'none') continue;
      const matrix = new DOMMatrixReadOnly(transform);
      dx += matrix.m41;
      dy += matrix.m42;
    }
    return { x: rect.left + rect.height / 2 - dx, y: rect.top + rect.height / 2 - dy, width: rect.height };
  }

  /*
   * Línea de tiempo de la intro (0 → 1 a lo largo del sentinel):
   *   0.02–0.28  el título sube y se desvanece
   *   0.03–0.40  el logo viaja al navbar (llega antes de que la portada se arme)
   *   0.08–0.40  la portada azul con retícula se levanta como una hoja
   *   0.32–0.42  el navbar muestra su logo (navbar.ts) y el grande se funde en él
   *   0.28–0.72  los papeles de la portada se colocan uno a uno
   * El último tramo (0.72–1) deja la portada quieta antes de seguir bajando.
   */
  private actualizarBrandHero(progress: number): void {
    const sentinel = this.brandSentinel?.nativeElement;
    const logo = this.brandLogo?.nativeElement;
    const name = this.brandName?.nativeElement;
    const nameSub = this.brandNameSub?.nativeElement;
    const cover = this.brandCover?.nativeElement;
    if (!sentinel || !logo || !name || !nameSub || !cover) return;
    if (!this.logoOrigin) this.medirLogoInicial();

    const travel = this.easeInOutCubic(Math.min(1, Math.max(0, (progress - 0.03) / 0.37)));

    const targetSelector = window.innerWidth >= 1024
      ? '.navbar-desktop .navbar-compact-logo img'
      : '.navbar-mobile .navbar-mobile-brand-logo img';
    const target = document.querySelector(targetSelector) as HTMLElement | null;
    const sticky = sentinel.querySelector('.home-brand-sticky') as HTMLElement | null;

    if (target && sticky && this.logoOrigin) {
      const base = sticky.getBoundingClientRect();
      const destino = this.centroSinTraslacion(target);
      const translateX = destino.x - (base.left + this.logoOrigin.x);
      const translateY = destino.y - (base.top + this.logoOrigin.y);
      const targetScale = Math.max(0.05, destino.width / Math.max(this.logoOrigin.width, 1));
      // Escala geométrica: la reducción se percibe uniforme durante todo el viaje.
      const scale = Math.pow(targetScale, travel);

      logo.style.transform =
        `translate3d(${(translateX * travel).toFixed(2)}px, ` +
        `${(translateY * travel).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    }

    // Ya en su sitio, el logo grande se funde con el del navbar (relevo 0.36–0.42).
    logo.style.opacity = (1 - this.smoothstep(0.36, 0.42, progress)).toFixed(4);
    logo.style.visibility = progress >= 0.425 ? 'hidden' : 'visible';

    // Título y subtítulo salen con un leve escalonado.
    const titleDistanceFactor = Math.min(1, Math.max(0.52, window.innerHeight / 780));
    this.aplicarSalidaTitulo(name, progress, 0.02, 0.24, -96 * titleDistanceFactor);
    this.aplicarSalidaTitulo(nameSub, progress, 0.05, 0.23, -84 * titleDistanceFactor);

    // La portada azul con retícula se levanta como una hoja y descubre la portada armada.
    const lift = this.easeInOutCubic(Math.min(1, Math.max(0, (progress - 0.08) / 0.32)));
    cover.style.transform = `translate3d(0, ${(-101 * lift).toFixed(3)}%, 0)`;
    cover.style.visibility = lift >= 1 ? 'hidden' : 'visible';

    const hint = this.scrollHint?.nativeElement;
    if (hint) hint.style.opacity = (1 - this.smoothstep(0, 0.05, progress)).toFixed(4);

    // Los papeles de la portada llegan en la misma línea de tiempo y se clavan.
    for (const papel of this.papeles) {
      const local = Math.min(1, Math.max(0, (progress - papel.start) / Math.max(papel.length, 0.001)));
      const s = this.reducirMovimiento ? (local > 0 ? 1 : 0) : this.easeOutCubic(local);
      papel.element.style.setProperty('--s', s.toFixed(4));
      papel.element.style.setProperty('--dx', `${papel.dx}px`);
      papel.element.style.setProperty('--dy', `${papel.dy}px`);
      papel.element.style.setProperty('--dr', `${papel.dr}deg`);
      papel.element.style.visibility = s <= 0 ? 'hidden' : 'visible';
    }
  }

  private aplicarSalidaTitulo(
    element: HTMLElement,
    progress: number,
    start: number,
    duration: number,
    distance: number
  ): void {
    const localProgress = Math.min(1, Math.max(0, (progress - start) / duration));
    const eased = this.easeInOutSine(localProgress);
    element.style.transform =
      `translate3d(0, ${(distance * eased).toFixed(2)}px, 0) ` +
      `scale(${(1 - 0.04 * eased).toFixed(4)})`;
    // La opacidad se completa antes que el desplazamiento para que el texto
    // no quede visible y detenido al final de su recorrido.
    element.style.opacity = (1 - this.smoothstep(0, 0.85, localProgress)).toFixed(4);
    element.style.visibility = localProgress >= 1 ? 'hidden' : 'visible';
  }

  // ── Revelado bajo el pliegue: los avisos caen en cascada al entrar ──

  private inicializarRevelados(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          // Una vez clavado, el aviso se queda: no se vuelve a ocultar.
          this.revealObserver?.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );

    this.observarElementosRevelados();
    this.subs.push(
      this.revealItems.changes.subscribe(() => {
        requestAnimationFrame(() => this.observarElementosRevelados());
      })
    );
  }

  private observarElementosRevelados(): void {
    if (!this.revealObserver) return;
    this.revealItems.forEach(({ nativeElement }) => {
      if (!nativeElement.classList.contains('is-visible')) this.revealObserver?.observe(nativeElement);
    });
  }

  // ── Curvas ────────────────────────────────────────────────────────

  private easeInOutCubic(value: number): number {
    return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  private easeOutCubic(value: number): number {
    return 1 - Math.pow(1 - value, 3);
  }

  // Curva suave para movimiento ligado al scroll: no se queda "pegada" al
  // inicio ni acelera bruscamente a mitad de recorrido.
  private easeInOutSine(value: number): number {
    return -(Math.cos(Math.PI * value) - 1) / 2;
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // ── Datos ─────────────────────────────────────────────────────────

  /** Con conexión: datos en vivo y, si llegaron completos, se renueva la copia offline. */
  private async cargarEnLinea(): Promise<void> {
    const [noticiasOk, eventosOk] = await Promise.all([this.cargarNoticias(), this.cargarEventos()]);
    if (noticiasOk && eventosOk) {
      this.copiaInicio.liberar(this.copiaActual);
      this.copiaActual = null;
      this.copiaOffline = null;
      void this.copiaInicio.guardar(this.noticias, this.eventoDestacado, this.imagenesDestacado[0] ?? null);
    } else {
      // La red falló a medio camino: se completa con la copia guardada.
      await this.cargarCopia({ noticias: !noticiasOk, evento: !eventosOk });
    }
  }

  /** Sin conexión: muestra la última copia de Inicio guardada en este dispositivo. */
  private async cargarCopia(partes = { noticias: true, evento: true }): Promise<void> {
    if (partes.noticias) this.cargandoNoticias = true;
    if (partes.evento) this.cargandoEventos = true;

    const copia = await this.copiaInicio.leer();
    this.copiaInicio.liberar(this.copiaActual);
    this.copiaActual = copia;
    this.copiaOffline = copia?.savedAt ?? null;
    const local = (url: string | null): string | null => (url ? copia?.imagenes.get(url) ?? null : null);

    if (partes.noticias) {
      this.noticias = (copia?.noticias ?? []).map((n) => ({
        ...n,
        imagen_url: local(n.imagen_url),
        mediaKind: n.aspectRatio ? (n.aspectRatio >= 1.25 ? 'landscape' : n.aspectRatio <= 0.9 ? 'portrait' : 'square') : 'no-media',
      }));
      this.cargandoNoticias = false;
    }

    if (partes.evento) {
      const evento = copia?.evento ?? null;
      this.eventoDestacado = evento
        ? { ...evento, imagen_principal: null, imagenes: [], destacado: true }
        : null;
      const imagen = local(evento?.imagen ?? null);
      this.imagenesDestacado = imagen ? [imagen] : [];
      this.imagenActiva = 0;
      this.carruselAutomatico = false;
      this.flyerProporcion = null;
      this.flyerCargado = false;
      this.flyerError = false;
      this.cargandoEventos = false;
    }
    this.revisarImagenesListas();
  }

  /** Devuelve si las noticias llegaron del servidor. */
  async cargarNoticias(): Promise<boolean> {
    this.cargandoNoticias = true;

    try {
      const noticias = await firstValueFrom(this.newsService.getPublicNews());
      const listaNoticias = Array.isArray(noticias) ? (noticias as NoticiaHome[]) : [];
      const noticiasDetectadas = await Promise.all(
        listaNoticias.map((noticia) => this.detectarMediaNoticia(noticia))
      );

      if (!this.connection.available()) return false;
      this.noticias = noticiasDetectadas;
      return true;
    } catch (error) {
      console.error('Error al cargar noticias:', error);
      this.noticias = [];
      return false;
    } finally {
      this.cargandoNoticias = false;
      this.revisarImagenesListas();
    }
  }

  /** Devuelve si los eventos llegaron del servidor. */
  async cargarEventos(): Promise<boolean> {
    this.cargandoEventos = true;

    try {
      const eventos = await firstValueFrom(this.eventsService.getPublicEvents());
      const listaEventos = Array.isArray(eventos) ? (eventos as EventoHome[]) : [];

      if (!this.connection.available()) return false;
      this.eventoDestacado = listaEventos.find((evento) => this.normalizarBooleano(evento?.destacado)) ?? null;
      this.imagenesDestacado = this.eventoDestacado ? this.obtenerImagenesEvento(this.eventoDestacado) : [];
      this.imagenActiva = 0;
      this.carruselAutomatico = this.imagenesDestacado.length > 1 && !this.reducirMovimiento;
      this.flyerProporcion = null;
      this.flyerCargado = false;
      this.flyerError = false;
      return true;
    } catch (error) {
      console.error('Error al cargar eventos:', error);
      this.eventoDestacado = null;
      this.imagenesDestacado = [];
      return false;
    } finally {
      this.cargandoEventos = false;
      this.revisarImagenesListas();
    }
  }

  private detectarMediaNoticia(noticia: NoticiaHome): Promise<NoticiaDetectada> {
    if (noticia.video_url) {
      return Promise.resolve({ ...noticia, mediaKind: 'landscape', aspectRatio: 16 / 9 });
    }

    if (!noticia.imagen_url) {
      return Promise.resolve({ ...noticia, mediaKind: 'no-media', aspectRatio: null });
    }

    return new Promise((resolve) => {
      const image = new Image();

      image.onload = () => {
        const width = image.naturalWidth || 1;
        const height = image.naturalHeight || 1;
        const aspectRatio = width / height;

        let mediaKind: NewsMediaKind;
        if (aspectRatio >= 1.25) mediaKind = 'landscape';
        else if (aspectRatio <= 0.9) mediaKind = 'portrait';
        else mediaKind = 'square';

        resolve({ ...noticia, mediaKind, aspectRatio });
      };

      image.onerror = () => resolve({ ...noticia, mediaKind: 'square', aspectRatio: 1 });
      image.src = noticia.imagen_url!;
    });
  }

  // ── Navegación dentro de la página ───────────────────────────────

  /**
   * Desplaza a una sección de esta página. Un href="#id" no sirve aquí: el
   * router lo resuelve contra la ruta base y no contra la sección.
   */
  irASeccion(id: string, evento?: Event): void {
    evento?.preventDefault();
    const destino = document.getElementById(id);
    if (!destino) return;
    // Se descuenta el navbar visible (escritorio o móvil) para no tapar el título.
    const navbar = Array.from(document.querySelectorAll<HTMLElement>('.navbar-desktop, .navbar-mobile'))
      .find((nav) => getComputedStyle(nav).display !== 'none');
    const alto = navbar?.getBoundingClientRect().bottom ?? 0;
    const top = destino.getBoundingClientRect().top + window.scrollY - Math.max(0, alto) - 16;
    window.scrollTo({ top, behavior: this.reducirMovimiento ? 'auto' : 'smooth' });
  }

  // ── Carga de imágenes ─────────────────────────────────────────────

  alCargarFlyer(evento: Event): void {
    const imagen = evento.target as HTMLImageElement | null;
    if (imagen?.naturalWidth && imagen.naturalHeight) {
      this.flyerProporcion = imagen.naturalWidth / imagen.naturalHeight;
    }
    this.flyerCargado = true;
  }

  /**
   * La imagen del flyer puede venir de caché y terminar antes de que Angular
   * escuche su `load`: tras pintar los datos se revisa si ya está completa para
   * que no se quede oculta en el hueco de carga.
   */
  private revisarImagenesListas(): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const flyer = document.querySelector<HTMLImageElement>('app-inicio .mu-flyer-media img');
      if (flyer?.complete && flyer.naturalWidth && !this.flyerCargado) {
        this.ngZone.run(() => this.alCargarFlyer({ target: flyer } as unknown as Event));
      }
    }, 60);
  }

  // ── Formato ───────────────────────────────────────────────────────

  formatearFechaEvento(fecha?: string | null): string {
    if (!fecha) return '';
    const texto = new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return texto.charAt(0).toLocaleUpperCase('es-MX') + texto.slice(1);
  }

  formatearFechaCopia(marca: number | null): string {
    if (!marca) return '';
    // 24 horas: con «p.m.» la frase terminaba en doble punto.
    return new Date(marca).toLocaleString('es-MX', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  formatearFechaCorta(fecha?: string | null): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatearModalidad(tipo?: string | null): string {
    if (!tipo) return '';
    const t = tipo.toUpperCase();
    if (t === 'PRESENCIAL') return 'Presencial';
    if (t === 'VIRTUAL') return 'En línea';
    return tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
  }

  formatearHoraEvento(fecha?: string | null): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  /** Inclinación estable de cada papel según su posición: el mural se ve hecho a mano. */
  inclinacion(indice: number): string {
    const giros = [-1.6, 1.2, -0.7, 1.9, -1.2, 0.8, -2, 1.4];
    return `${giros[indice % giros.length]}deg`;
  }

  // ── Pila de fotos del evento ──────────────────────────────────────

  /**
   * Profundidad de cada foto en la pila: 0 arriba, 1 y 2 asoman detrás,
   * 3 = la que acaba de salir (se va de lado), 4 = guardada al fondo, invisible.
   */
  profundidadFoto(indice: number): number {
    const total = this.imagenesDestacado.length;
    const k = (indice - this.imagenActiva + total) % total;
    if (k <= 2 && k < total - (total > 3 ? 1 : 0)) return k;
    if (k === total - 1) return 3;
    return 4;
  }

  /** Imagen principal primero y después el resto de la galería, sin repetir. */
  private obtenerImagenesEvento(evento: EventoHome): string[] {
    const galeria = [...(evento.imagenes ?? [])]
      .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))
      .map((imagen) => imagen.url)
      .filter(Boolean);
    const urls = evento.imagen_principal ? [evento.imagen_principal, ...galeria] : galeria;
    return [...new Set(urls)];
  }

  irAImagenDestacada(indice: number, manual = true): void {
    const total = this.imagenesDestacado.length;
    if (!total) return;
    this.imagenActiva = (indice + total) % total;
    if (manual) this.carruselAutomatico = false;
  }

  siguienteImagen(manual = false): void {
    this.irAImagenDestacada(this.imagenActiva + 1, manual);
  }

  anteriorImagen(): void {
    this.irAImagenDestacada(this.imagenActiva - 1, true);
  }

  iniciarDeslizamiento(evento: PointerEvent): void {
    if (this.imagenesDestacado.length < 2) return;
    this.inicioDeslizamiento = { x: evento.clientX, y: evento.clientY };
  }

  terminarDeslizamiento(evento: PointerEvent): void {
    const inicio = this.inicioDeslizamiento;
    this.inicioDeslizamiento = null;
    if (!inicio) return;
    const dx = evento.clientX - inicio.x;
    const dy = evento.clientY - inicio.y;
    // Solo un gesto horizontal claro: no interfiere con el desplazamiento vertical.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) this.siguienteImagen(true);
    else this.anteriorImagen();
  }

  cancelarDeslizamiento(): void {
    this.inicioDeslizamiento = null;
  }

  normalizarBooleano(valor: unknown): boolean {
    return valor === true || valor === 1 || valor === '1' || valor === 'true';
  }

  truncarTexto(texto: string | null | undefined, limite = 220): string {
    if (!texto) return '';
    if (texto.length <= limite) return texto;
    return `${texto.slice(0, limite).trim()}…`;
  }
}
