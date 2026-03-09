import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  OnDestroy,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
  ViewEncapsulation,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsService } from '../../api/services/news.service';

interface Slide {
  id: number;
  tipo: 'imagen' | 'video';
  url: string;
  titulo: string;
  contenido: string;
  categoria?: string;
  duracion?: number;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class InicioComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChildren('videoRef') videoRefs!: QueryList<ElementRef<HTMLVideoElement>>;

  noticias: any[] = [];
  slides: Slide[] = [];
  currentSlideIndex = 0;
  isTransitioning = false;
  autoplayInterval: any;
  cargandoNoticias = true;

  readonly IMAGE_DURATION = 5000;

  private scrollObserver!: IntersectionObserver;
  private lastScrollY = 0;
  private scrollDirection: 'down' | 'up' = 'down';
  private scrollRafId = 0;
  private visibilityMap = new Map<HTMLElement, boolean>();
  private animReady = false;

  constructor(
    private newsService: NewsService,
    private ngZone: NgZone
  ) {}

  // ─────────────────────────────────────────
  //  LIFECYCLE
  // ─────────────────────────────────────────

  async ngOnInit() {
    await this.cargarNoticias();
  }

  ngAfterViewInit() {
    this.videoRefs.changes.subscribe(() => this.gestionarVideo());

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy() {
    this.detenerAutoplay();
    this.scrollObserver?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
    cancelAnimationFrame(this.scrollRafId);
    // Limpiar clase del body al salir
    document.body.classList.remove('anim-ready');
  }

  // ─────────────────────────────────────────
  //  NOTICIAS
  // ─────────────────────────────────────────

  async cargarNoticias() {
    try {
      this.cargandoNoticias = true;

      this.newsService.getPublicNews().subscribe({
        next: (noticias) => {
          this.noticias = noticias || [];

          this.slides = this.noticias
            .filter(n => n.imagen_url || n.video_url)
            .map(n => {
              if (n.video_url) {
                return {
                  id: n.id_noticia,
                  tipo: 'video' as const,
                  url: n.video_url,
                  titulo: n.titulo,
                  contenido: n.contenido,
                  categoria: n.categoria
                };
              } else {
                return {
                  id: n.id_noticia,
                  tipo: 'imagen' as const,
                  url: n.imagen_url,
                  titulo: n.titulo,
                  contenido: n.contenido,
                  categoria: n.categoria,
                  duracion: this.IMAGE_DURATION
                };
              }
            });

          this.cargandoNoticias = false;
          if (this.slides.length > 0) this.iniciarAutoplay();

          // Esperar a que Angular termine de renderizar el DOM
          // requestAnimationFrame doble garantiza que el paint ya ocurrió
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.initScrollAnimations();
            });
          });
        },
        error: (err) => {
          console.error('Error al cargar noticias:', err);
          this.cargandoNoticias = false;
        }
      });

    } catch (error) {
      console.error('Error en cargarNoticias():', error);
      this.cargandoNoticias = false;
    }
  }

  // ─────────────────────────────────────────
  //  ANIMACIONES DE SCROLL
  // ─────────────────────────────────────────

  private initScrollAnimations(): void {
    const articles = Array.from(
      document.querySelectorAll<HTMLElement>('#noticias .news-item')
    );

    if (!articles.length) return;

    // 1. Aplicar stagger de palabras ANTES de activar estados ocultos
    articles.forEach((article) => {
      const words = article.querySelectorAll<HTMLElement>('.news-word');
      words.forEach((word, wi) => {
        const delay = 0.38 + wi * 0.042;
        word.style.transitionDelay = `${delay}s`;
      });
    });

    // 2. Activar estados iniciales ocultos SOLO si IntersectionObserver
    //    está disponible (evita SSR o entornos sin soporte)
    if (!('IntersectionObserver' in window)) return;

    // 3. Marcar body como listo para animaciones
    //    Esto activa los estados CSS ocultos
    document.body.classList.add('anim-ready');
    this.animReady = true;

    // 4. Configurar observer
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          const wasVisible = this.visibilityMap.get(el) ?? false;

          if (entry.isIntersecting) {
            this.visibilityMap.set(el, true);
            el.classList.remove('is-leaving-up');
            // Pequeño delay para que el estado oculto aplique antes de animar
            requestAnimationFrame(() => {
              el.classList.add('is-visible');
            });

          } else {
            this.visibilityMap.set(el, false);
            el.classList.remove('is-visible');

            if (wasVisible && this.scrollDirection === 'up') {
              el.classList.add('is-leaving-up');

              setTimeout(() => {
                if (!this.visibilityMap.get(el)) {
                  el.classList.remove('is-leaving-up');
                }
              }, 800);
            } else {
              el.classList.remove('is-leaving-up');
            }
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    articles.forEach((article) => {
      this.scrollObserver.observe(article);
      this.visibilityMap.set(article, false);
    });
  }

  private onScroll = (): void => {
    cancelAnimationFrame(this.scrollRafId);
    this.scrollRafId = requestAnimationFrame(() => {
      const currentY = window.scrollY;
      this.scrollDirection = currentY > this.lastScrollY ? 'down' : 'up';
      this.lastScrollY = currentY;
    });
  };

  // ─────────────────────────────────────────
  //  COVERFLOW
  // ─────────────────────────────────────────

  get currentSlide(): Slide | null {
    return this.slides[this.currentSlideIndex] || null;
  }

  getRelativeIndex(offset: number): number {
    const len = this.slides.length;
    return (this.currentSlideIndex + offset + len) % len;
  }

  isVisible(index: number): boolean {
    const visible = [
      this.currentSlideIndex,
      this.getRelativeIndex(-1),
      this.getRelativeIndex(-2),
      this.getRelativeIndex(1),
      this.getRelativeIndex(2)
    ];
    return visible.includes(index);
  }

  iniciarAutoplay() {
    this.detenerAutoplay();
    if (this.currentSlide?.tipo === 'imagen') {
      this.autoplayInterval = setTimeout(() => this.siguiente(), this.IMAGE_DURATION);
    }
  }

  detenerAutoplay() {
    if (this.autoplayInterval) {
      clearTimeout(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }

  gestionarVideo() {
    if (!this.videoRefs) return;
    let videoCount = 0;
    this.slides.forEach((slide, slideIndex) => {
      if (slide.tipo !== 'video') return;
      const vidEl = this.videoRefs.toArray()[videoCount]?.nativeElement;
      videoCount++;
      if (!vidEl) return;
      if (slideIndex === this.currentSlideIndex) {
        vidEl.currentTime = 0;
        vidEl.play().catch(() => {});
      } else {
        vidEl.pause();
      }
    });
  }

  siguiente() {
    if (this.isTransitioning || this.slides.length === 0) return;
    this.isTransitioning = true;
    this.detenerAutoplay();
    setTimeout(() => {
      this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slides.length;
      this.isTransitioning = false;
      this.iniciarAutoplay();
      this.gestionarVideo();
    }, 500);
  }

  anterior() {
    if (this.isTransitioning || this.slides.length === 0) return;
    this.isTransitioning = true;
    this.detenerAutoplay();
    setTimeout(() => {
      this.currentSlideIndex = this.currentSlideIndex === 0
        ? this.slides.length - 1
        : this.currentSlideIndex - 1;
      this.isTransitioning = false;
      this.iniciarAutoplay();
      this.gestionarVideo();
    }, 500);
  }

  irASlide(index: number) {
    if (this.isTransitioning || index === this.currentSlideIndex || this.slides.length === 0) return;
    this.isTransitioning = true;
    this.detenerAutoplay();
    setTimeout(() => {
      this.currentSlideIndex = index;
      this.isTransitioning = false;
      this.iniciarAutoplay();
      this.gestionarVideo();
    }, 500);
  }

  onVideoEnded() { this.siguiente(); }
  onVideoError() { console.error('Error al cargar el video'); this.siguiente(); }
}