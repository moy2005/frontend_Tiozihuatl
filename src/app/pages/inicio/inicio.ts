import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
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

type NewsMediaKind = 'landscape' | 'portrait' | 'square' | 'no-media';

interface NoticiaHome {
  id_noticia: number;
  titulo: string;
  contenido: string;
  imagen_url?: string | null;
  video_url?: string | null;
  categoria?: string | null;
}

interface NoticiaDetectada extends NoticiaHome {
  mediaKind: NewsMediaKind;
  aspectRatio: number | null;
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

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule, TextoEnlazadoComponent],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class InicioComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly connection = inject(ConnectivityService);
  @ViewChild('brandSentinel') brandSentinel!: ElementRef<HTMLElement>;
  @ViewChild('brandLogo') brandLogo!: ElementRef<HTMLElement>;
  @ViewChild('brandName') brandName!: ElementRef<HTMLElement>;
  @ViewChild('brandNameSub') brandNameSub!: ElementRef<HTMLElement>;
  @ViewChild('brandOverlay') brandOverlay!: ElementRef<HTMLElement>;
  @ViewChild('heroContent') heroContent!: ElementRef<HTMLElement>;
  @ViewChild('heroBackdrop') heroBackdrop!: ElementRef<HTMLElement>;
  @ViewChild('heroWave') heroWave!: ElementRef<SVGElement>;
  @ViewChildren('revealItem') revealItems!: QueryList<ElementRef<HTMLElement>>;

  noticias: NoticiaDetectada[] = [];
  // Inicio muestra un único evento destacado: el primero marcado como tal.
  eventoDestacado: EventoHome | null = null;
  // Carrusel del evento destacado: avanza solo al terminar la barra del punto activo
  // (CSS la pausa al pasar el puntero o enfocar) y se detiene al usarlo a mano.
  imagenesDestacado: string[] = [];
  imagenActiva = 0;
  carruselAutomatico = false;
  // Proporción (ancho / alto) de cada imagen: el carrusel adopta la de la imagen
  // activa para mostrarla completa, sin recortes ni espacios sobrantes.
  private proporcionesDestacado: number[] = [];
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
  private revealObserver?: IntersectionObserver;
  private revealChanges?: Subscription;

  constructor(
    private newsService: NewsService,
    private eventsService: EventsService,
    private ngZone: NgZone
  ) {
    effect(() => {
      const available = this.connection.available();
      untracked(() => {
        if (available) void Promise.all([this.cargarNoticias(), this.cargarEventos()]);
        else { this.noticias = []; this.eventoDestacado = null; this.imagenesDestacado = []; this.cargandoNoticias = false; this.cargandoEventos = false; }
      });
    });
  }

  async ngOnInit(): Promise<void> {
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.medirLogoInicial();
        window.addEventListener('scroll', this.onBrandScroll, { passive: true });
        window.addEventListener('resize', this.onBrandResize, { passive: true });
        this.inicializarRevelados();
        this.programarBrandFrame();
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
    this.revealChanges?.unsubscribe();
  }

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

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (this.brandProgress < 0 || reduceMotion) {
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
  // Se usa la altura: el contenedor de escritorio crece en ancho con el
  // progreso y encoge la imagen, pero el logo es cuadrado y su altura es fija.
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

  private actualizarBrandHero(progress: number): void {
    const sentinel = this.brandSentinel?.nativeElement;
    const logo = this.brandLogo?.nativeElement;
    const name = this.brandName?.nativeElement;
    const nameSub = this.brandNameSub?.nativeElement;
    const overlay = this.brandOverlay?.nativeElement;
    const heroContent = this.heroContent?.nativeElement;
    const heroBackdrop = this.heroBackdrop?.nativeElement;
    const heroWave = this.heroWave?.nativeElement;

    if (
      !sentinel ||
      !logo ||
      !name ||
      !nameSub ||
      !overlay ||
      !heroContent ||
      !heroBackdrop ||
      !heroWave
    ) return;
    if (!this.logoOrigin) this.medirLogoInicial();

    // El logo viaja de 0.02 a 0.96: termina justo cuando el navbar completa
    // su aparición (0.80 → 0.96), así el relevo entre ambos es continuo.
    const travelProgress = Math.min(1, Math.max(0, (progress - 0.02) / 0.94));
    const eased = this.easeInOutSine(travelProgress);

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
      const scale = Math.pow(targetScale, eased);

      logo.style.transform =
        `translate3d(${(translateX * eased).toFixed(2)}px, ` +
        `${(translateY * eased).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    }

    const logoFade = 1 - this.smoothstep(0.84, 0.96, progress);
    logo.style.opacity = logoFade.toFixed(4);
    logo.style.visibility = progress >= 0.965 ? 'hidden' : 'visible';

    // Título y subtítulo salen junto con el inicio del viaje del logo, con un
    // leve escalonado, y desaparecen antes de que el logo llegue al navbar.
    const titleDistanceFactor = Math.min(1, Math.max(0.52, window.innerHeight / 780));
    this.aplicarSalidaTitulo(name, progress, 0.04, 0.56, -96 * titleDistanceFactor);
    this.aplicarSalidaTitulo(nameSub, progress, 0.09, 0.56, -84 * titleDistanceFactor);

    const backgroundAlpha = 1 - Math.min(1, Math.max(0, (progress - 0.48) / 0.4));
    overlay.style.background = `rgba(63, 166, 232, ${backgroundAlpha.toFixed(4)})`;

    const contentProgress = this.easeInOut(
      Math.min(1, Math.max(0, (progress - 0.48) / 0.4))
    );
    const contentDistance = window.innerWidth <= 640 ? 30 : window.innerWidth <= 1023 ? 40 : 52;
    heroContent.style.opacity = contentProgress.toFixed(4);
    heroContent.style.transform =
      `translate3d(0, ${(contentDistance * (1 - contentProgress)).toFixed(2)}px, 0) ` +
      `scale(${(0.985 + contentProgress * 0.015).toFixed(4)})`;

    heroBackdrop.style.opacity = (0.1 * contentProgress).toFixed(4);
    heroBackdrop.style.transform =
      `translate3d(0, ${(16 * (1 - contentProgress)).toFixed(2)}px, 0) ` +
      `scale(${(1.08 - contentProgress * 0.08).toFixed(4)})`;

    heroWave.style.opacity = contentProgress.toFixed(4);
    heroWave.style.transform =
      `translate3d(0, ${((window.innerWidth <= 640 ? 42 : 70) * (1 - contentProgress)).toFixed(2)}px, 0)`;
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
    // La opacidad se completa un poco antes que el desplazamiento para que el
    // texto no quede visible y detenido al final de su recorrido.
    element.style.opacity = (1 - this.smoothstep(0, 0.85, localProgress)).toFixed(4);
    element.style.visibility = localProgress >= 1 ? 'hidden' : 'visible';
  }

  private inicializarRevelados(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            element.classList.add('is-visible');
            return;
          }

          if (entry.boundingClientRect.top > window.innerHeight * 0.72) {
            element.classList.remove('is-visible');
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -7% 0px',
      }
    );

    this.observarElementosRevelados();
    this.revealChanges = this.revealItems.changes.subscribe(() => {
      requestAnimationFrame(() => this.observarElementosRevelados());
    });
  }

  private observarElementosRevelados(): void {
    if (!this.revealObserver) return;
    this.revealItems.forEach(({ nativeElement }) => {
      this.revealObserver?.observe(nativeElement);
    });
  }

  private easeInOut(value: number): number {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  // Curva más suave que la cúbica para movimiento ligado al scroll: no se
  // queda "pegada" al inicio ni acelera bruscamente a mitad de recorrido.
  private easeInOutSine(value: number): number {
    return -(Math.cos(Math.PI * value) - 1) / 2;
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  async cargarNoticias(): Promise<void> {
    this.cargandoNoticias = true;

    try {
      const noticias = await firstValueFrom(this.newsService.getPublicNews());
      const listaNoticias = Array.isArray(noticias) ? (noticias as NoticiaHome[]) : [];
      const noticiasDetectadas = await Promise.all(
        listaNoticias.map((noticia) => this.detectarMediaNoticia(noticia))
      );

      if (!this.connection.available()) return;
      this.noticias = noticiasDetectadas;
    } catch (error) {
      console.error('Error al cargar noticias:', error);
      this.noticias = [];
    } finally {
      this.cargandoNoticias = false;
    }
  }

  async cargarEventos(): Promise<void> {
    this.cargandoEventos = true;

    try {
      const eventos = await firstValueFrom(this.eventsService.getPublicEvents());
      const listaEventos = Array.isArray(eventos) ? (eventos as EventoHome[]) : [];

      if (!this.connection.available()) return;
      this.eventoDestacado = listaEventos.find((evento) => this.normalizarBooleano(evento?.destacado)) ?? null;
      this.imagenesDestacado = this.eventoDestacado ? this.obtenerImagenesEvento(this.eventoDestacado) : [];
      this.proporcionesDestacado = [];
      this.imagenActiva = 0;
      const reducirMovimiento = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.carruselAutomatico = this.imagenesDestacado.length > 1 && !reducirMovimiento;
    } catch (error) {
      console.error('Error al cargar eventos:', error);
      this.eventoDestacado = null;
      this.imagenesDestacado = [];
    } finally {
      this.cargandoEventos = false;
    }
  }

  private detectarMediaNoticia(noticia: NoticiaHome): Promise<NoticiaDetectada> {
    if (noticia.video_url) {
      return Promise.resolve({
        ...noticia,
        mediaKind: 'landscape',
        aspectRatio: 16 / 9,
      });
    }

    if (!noticia.imagen_url) {
      return Promise.resolve({
        ...noticia,
        mediaKind: 'no-media',
        aspectRatio: null,
      });
    }

    return new Promise((resolve) => {
      const image = new Image();

      image.onload = () => {
        const width = image.naturalWidth || 1;
        const height = image.naturalHeight || 1;
        const aspectRatio = width / height;

        let mediaKind: NewsMediaKind;
        if (aspectRatio >= 1.25) {
          mediaKind = 'landscape';
        } else if (aspectRatio <= 0.9) {
          mediaKind = 'portrait';
        } else {
          mediaKind = 'square';
        }

        resolve({
          ...noticia,
          mediaKind,
          aspectRatio,
        });
      };

      image.onerror = () => {
        resolve({
          ...noticia,
          mediaKind: 'square',
          aspectRatio: 1,
        });
      };

      image.src = noticia.imagen_url!;
    });
  }

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

  formatearHoraEvento(fecha?: string | null): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
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

  /** Guarda la proporción real de una imagen del carrusel cuando termina de cargar. */
  registrarProporcion(indice: number, event: Event): void {
    const imagen = event.target as HTMLImageElement | null;
    if (!imagen?.naturalWidth || !imagen.naturalHeight) return;
    this.proporcionesDestacado[indice] = imagen.naturalWidth / imagen.naturalHeight;
  }

  /** Proporción que adopta el carrusel: la de la imagen activa (4:3 mientras carga). */
  get proporcionActiva(): number {
    return this.proporcionesDestacado[this.imagenActiva] || this.proporcionesDestacado[0] || 4 / 3;
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
    return `${texto.slice(0, limite).trim()}...`;
  }
}
