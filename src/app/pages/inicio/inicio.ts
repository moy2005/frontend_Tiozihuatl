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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { NewsService } from '../../api/services/news.service';
import { EventsService } from '../../api/services/events.service';

type NewsMediaKind = 'landscape' | 'portrait' | 'square' | 'no-media';
type EventMediaKind = 'landscape' | 'portrait' | 'square' | 'no-media';

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

interface NewsRenderGroup {
  layout: 'landscape' | 'grid';
  item?: NoticiaDetectada;
  items?: NoticiaDetectada[];
}

interface EventoHomeImagen {
  url: string;
}

interface EventoHome {
  id_evento: number;
  titulo: string;
  imagen_principal?: string | null;
  imagenes?: EventoHomeImagen[];
  destacado?: boolean | number | string;
}

interface EventoHomeDetectado extends EventoHome {
  mediaKind: EventMediaKind;
  aspectRatio: number | null;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class InicioComponent implements OnInit, AfterViewInit, OnDestroy {
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
  noticiasRender: NewsRenderGroup[] = [];
  eventosPreview: EventoHomeDetectado[] = [];
  cargandoNoticias = true;
  cargandoEventos = true;

  private scrollRafId = 0;
  private resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  private logoOrigin?: DOMRect;
  private revealObserver?: IntersectionObserver;
  private revealChanges?: Subscription;

  constructor(
    private newsService: NewsService,
    private eventsService: EventsService,
    private ngZone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarNoticias(), this.cargarEventos()]);
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.medirLogoInicial();
        window.addEventListener('scroll', this.onBrandScroll, { passive: true });
        window.addEventListener('resize', this.onBrandResize, { passive: true });
        this.inicializarRevelados();
        this.actualizarBrandHero();
      });
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onBrandScroll);
    window.removeEventListener('resize', this.onBrandResize);
    cancelAnimationFrame(this.scrollRafId);
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.revealObserver?.disconnect();
    this.revealChanges?.unsubscribe();
  }

  private onBrandScroll = (): void => {
    cancelAnimationFrame(this.scrollRafId);
    this.scrollRafId = requestAnimationFrame(() => this.actualizarBrandHero());
  };

  private onBrandResize = (): void => {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.medirLogoInicial();
      this.actualizarBrandHero();
    }, 120);
  };

  private medirLogoInicial(): void {
    const logo = this.brandLogo?.nativeElement;
    if (!logo) return;

    logo.style.transform = 'none';
    logo.style.opacity = '1';
    logo.style.visibility = 'visible';
    this.logoOrigin = logo.getBoundingClientRect();
  }

  private actualizarBrandHero(): void {
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

    const scrollY = window.scrollY;
    const sentinelTop = sentinel.getBoundingClientRect().top + scrollY;
    const stickyHeight =
      (sentinel.querySelector('.home-brand-sticky') as HTMLElement | null)?.clientHeight ||
      window.innerHeight;
    const scrollEnd = sentinelTop + sentinel.offsetHeight - stickyHeight;
    const rawProgress = scrollEnd <= sentinelTop
      ? (scrollY > sentinelTop ? 1 : 0)
      : (scrollY - sentinelTop) / (scrollEnd - sentinelTop);
    const progress = Math.min(1, Math.max(0, rawProgress));
    const travelProgress = Math.min(1, Math.max(0, (progress - 0.02) / 0.96));
    const eased = this.easeInOut(travelProgress);

    const targetSelector = window.innerWidth >= 1024
      ? '.navbar-desktop .navbar-compact-logo img'
      : '.navbar-mobile .navbar-mobile-brand-logo img';
    const target = document.querySelector(targetSelector) as HTMLElement | null;

    if (target && this.logoOrigin) {
      const targetRect = target.getBoundingClientRect();
      const origin = this.logoOrigin;
      const translateX =
        targetRect.left + targetRect.width / 2 - (origin.left + origin.width / 2);
      const translateY =
        targetRect.top + targetRect.height / 2 - (origin.top + origin.height / 2);
      const targetScale = targetRect.width / Math.max(origin.width, 1);
      const scale = 1 + eased * (targetScale - 1);
      const compactViewportFactor = Math.min(
        1,
        Math.max(0.55, Math.min(window.innerWidth / 1024, window.innerHeight / 760))
      );
      const tilt = Math.sin(travelProgress * Math.PI) * -3.2 * compactViewportFactor;
      const lift = Math.sin(travelProgress * Math.PI) * -14 * compactViewportFactor;

      logo.style.transform =
        `perspective(900px) translate3d(${(translateX * eased).toFixed(2)}px, ` +
        `${(translateY * eased + lift).toFixed(2)}px, 0) ` +
        `rotateY(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    }

    const logoFade = 1 - Math.min(1, Math.max(0, (progress - 0.86) / 0.11));
    logo.style.opacity = logoFade.toFixed(4);
    logo.style.visibility = progress >= 0.98 ? 'hidden' : 'visible';

    const titleDistanceFactor = Math.min(1, Math.max(0.52, window.innerHeight / 780));
    this.aplicarSalidaTitulo(name, progress, 0.14, 0.62, -118 * titleDistanceFactor);
    this.aplicarSalidaTitulo(nameSub, progress, 0.22, 0.66, -92 * titleDistanceFactor);

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
    const eased = this.easeInOut(localProgress);
    element.style.transform =
      `translate3d(0, ${(distance * eased).toFixed(2)}px, 0) ` +
      `scale(${(1 - 0.075 * eased).toFixed(4)})`;
    element.style.opacity = (1 - eased).toFixed(4);
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

  async cargarNoticias(): Promise<void> {
    this.cargandoNoticias = true;

    try {
      const noticias = await firstValueFrom(this.newsService.getPublicNews());
      const listaNoticias = Array.isArray(noticias) ? (noticias as NoticiaHome[]) : [];
      const noticiasDetectadas = await Promise.all(
        listaNoticias.map((noticia) => this.detectarMediaNoticia(noticia))
      );

      this.noticias = noticiasDetectadas;
      this.noticiasRender = this.construirGruposNoticias(noticiasDetectadas);
    } catch (error) {
      console.error('Error al cargar noticias:', error);
      this.noticias = [];
      this.noticiasRender = [];
    } finally {
      this.cargandoNoticias = false;
    }
  }

  async cargarEventos(): Promise<void> {
    this.cargandoEventos = true;

    try {
      const eventos = await firstValueFrom(this.eventsService.getPublicEvents());
      const listaEventos = Array.isArray(eventos) ? (eventos as EventoHome[]) : [];
      const eventosDetectados = await Promise.all(
        listaEventos.map((evento) => this.detectarMediaEvento(evento))
      );

      this.eventosPreview = eventosDetectados
        .filter((evento) => this.normalizarBooleano(evento?.destacado))
        .slice(0, 3);
    } catch (error) {
      console.error('Error al cargar eventos:', error);
      this.eventosPreview = [];
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

  private construirGruposNoticias(noticias: NoticiaDetectada[]): NewsRenderGroup[] {
    const grupos: NewsRenderGroup[] = [];
    let bufferGrid: NoticiaDetectada[] = [];

    const vaciarBuffer = () => {
      if (!bufferGrid.length) return;
      grupos.push({ layout: 'grid', items: [...bufferGrid] });
      bufferGrid = [];
    };

    for (const noticia of noticias) {
      if (noticia.mediaKind === 'portrait' || noticia.mediaKind === 'square') {
        bufferGrid.push(noticia);
        if (bufferGrid.length === 2) {
          vaciarBuffer();
        }
        continue;
      }

      if (noticia.mediaKind === 'no-media') {
        continue;
      }

      vaciarBuffer();

      grupos.push({ layout: 'landscape', item: noticia });
    }

    vaciarBuffer();
    return grupos;
  }

  obtenerClaseGrid(noticia: NoticiaDetectada): string {
    return noticia.mediaKind === 'portrait' ? 'home-news-card--portrait' : 'home-news-card--square';
  }

  obtenerAspectRatioCss(noticia: NoticiaDetectada): string {
    switch (noticia.mediaKind) {
      case 'landscape':
        return '2.45';
      case 'portrait':
        return '0.8';
      case 'square':
        return '1';
      default:
        return '1.4';
    }
  }

  obtenerImagenEvento(evento: EventoHome): string | null {
    return evento?.imagen_principal || evento?.imagenes?.[0]?.url || null;
  }

  obtenerAspectRatioEventoCss(evento: EventoHomeDetectado): string {
    switch (evento.mediaKind) {
      case 'landscape':
        return '1.3';
      case 'portrait':
        return '0.95';
      case 'square':
        return '1';
      default:
        return '1.2';
    }
  }

  private detectarMediaEvento(evento: EventoHome): Promise<EventoHomeDetectado> {
    const imagenUrl = this.obtenerImagenEvento(evento);

    if (!imagenUrl) {
      return Promise.resolve({
        ...evento,
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

        let mediaKind: EventMediaKind;
        if (aspectRatio >= 1.25) {
          mediaKind = 'landscape';
        } else if (aspectRatio <= 0.9) {
          mediaKind = 'portrait';
        } else {
          mediaKind = 'square';
        }

        resolve({
          ...evento,
          mediaKind,
          aspectRatio,
        });
      };

      image.onerror = () => {
        resolve({
          ...evento,
          mediaKind: 'square',
          aspectRatio: 1,
        });
      };

      image.src = imagenUrl;
    });
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
