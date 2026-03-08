import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
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

  constructor(private newsService: NewsService) {}

  async ngOnInit() {
    await this.cargarNoticias();
  }

  ngAfterViewInit() {
    // Cuando los videos ya están en el DOM, reproducir el central
    this.videoRefs.changes.subscribe(() => {
      this.gestionarVideo();
    });
  }

  ngOnDestroy() {
    this.detenerAutoplay();
  }

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

          if (this.slides.length > 0) {
            this.iniciarAutoplay();
          }
        },
        error: (error) => {
          console.error('Error al cargar noticias:', error);
          this.cargandoNoticias = false;
        }
      });

    } catch (error) {
      console.error('Error en cargarNoticias():', error);
      this.cargandoNoticias = false;
    }
  }

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
      this.autoplayInterval = setTimeout(() => {
        this.siguiente();
      }, this.IMAGE_DURATION);
    }
    // Para videos el avance se maneja en onVideoEnded()
  }

  detenerAutoplay() {
    if (this.autoplayInterval) {
      clearTimeout(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }

  /**
   * Recorre todos los <video> referenciados con #videoRef
   * y reproduce solo el que corresponde al slide central.
   * Se llama siempre DESPUÉS de actualizar currentSlideIndex.
   */
  gestionarVideo() {
    if (!this.videoRefs) return;

    // Construir un mapa: índice de slide → elemento video
    // videoRefs solo contiene videos (slides tipo 'video'),
    // así que necesitamos saber cuáles slides son video y en qué orden aparecen.
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

  onVideoEnded() {
    this.siguiente();
  }

  onVideoError() {
    console.error('Error al cargar el video');
    this.siguiente();
  }
}