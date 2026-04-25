import {
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NewsService } from '../../api/services/news.service';

interface Noticia {
  id_noticia: number;
  titulo: string;
  contenido: string;
  imagen_url?: string;
  video_url?: string;
  categoria?: string;
  fecha_publicacion: string;
  estado: string;
  // Propiedades dinámicas para dimensiones
  imageWidth?: number;
  imageHeight?: number;
  aspectRatio?: number;
  gridSpan?: { row: number; col: number };
}

@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './noticias.html',
  styleUrls: ['./noticias.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class NoticiasComponent implements OnInit, OnDestroy {
  cargandoNoticias = false;
  noticias: Noticia[] = [];
  noticiasFiltradas: Noticia[] = [];
  categorias: string[] = [];
  categoriaSeleccionada = 'Todas';
  noticiaSeleccionada: Noticia | null = null;

  constructor(
    private newsService: NewsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarNoticias();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  /**
   * Cargar noticias desde el servicio
   */
  async cargarNoticias(): Promise<void> {
    this.cargandoNoticias = true;
    
    this.newsService.getPublicNews().subscribe({
      next: async (noticias) => {
        console.log('✅ NOTICIAS CARGADAS:', noticias);
        
        this.noticias = noticias || [];
        
        // Cargar dimensiones de imágenes
        await this.cargarDimensionesImagenes();
        
        this.noticiasFiltradas = [...this.noticias];
        
        // Extraer categorías únicas
        this.extraerCategorias();
        
        this.cargandoNoticias = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar noticias:', error);
        this.cargandoNoticias = false;
      }
    });
  }

  /**
   * Cargar dimensiones reales de las imágenes
   */
  async cargarDimensionesImagenes(): Promise<void> {
    const promesas = this.noticias.map(noticia => {
      return new Promise<void>((resolve) => {
        if (noticia.imagen_url) {
          const img = new Image();
          img.onload = () => {
            noticia.imageWidth = img.naturalWidth;
            noticia.imageHeight = img.naturalHeight;
            noticia.aspectRatio = img.naturalWidth / img.naturalHeight;
            noticia.gridSpan = this.calcularGridSpan(noticia.aspectRatio);
            console.log(`📐 ${noticia.titulo}: ${noticia.imageWidth}x${noticia.imageHeight} (ratio: ${noticia.aspectRatio?.toFixed(2)})`);
            resolve();
          };
          img.onerror = () => {
            noticia.aspectRatio = 1.5; // Default
            noticia.gridSpan = { row: 1, col: 1 };
            resolve();
          };
          img.src = noticia.imagen_url;
        } else if (noticia.video_url) {
          // Para videos, usar ratio 16:9 por defecto
          noticia.aspectRatio = 16 / 9;
          noticia.gridSpan = this.calcularGridSpan(noticia.aspectRatio);
          resolve();
        } else {
          noticia.aspectRatio = 1;
          noticia.gridSpan = { row: 1, col: 1 };
          resolve();
        }
      });
    });

    await Promise.all(promesas);
  }

  /**
   * Calcular span del grid basado en aspect ratio
   */
  calcularGridSpan(aspectRatio: number): { row: number; col: number } {
    // Imágenes muy anchas (panorámicas)
    if (aspectRatio > 2) {
      return { row: 1, col: 2 };
    }
    // Imágenes anchas normales
    else if (aspectRatio > 1.4) {
      return { row: 1, col: 1 };
    }
    // Imágenes cuadradas
    else if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
      return { row: 1, col: 1 };
    }
    // Imágenes verticales
    else if (aspectRatio < 0.9) {
      return { row: 2, col: 1 };
    }
    // Default
    return { row: 1, col: 1 };
  }

  /**
   * Obtener estilos dinámicos para cada card
   */
  getCardStyle(noticia: Noticia): any {
    if (!noticia.gridSpan) {
      return {};
    }

    return {
      'grid-row': `span ${noticia.gridSpan.row}`,
      'grid-column': `span ${noticia.gridSpan.col}`
    };
  }

  /**
   * Extraer categorías únicas de las noticias
   */
  extraerCategorias(): void {
    const categoriasSet = new Set<string>();
    
    this.noticias.forEach(noticia => {
      if (noticia.categoria && noticia.categoria.trim()) {
        categoriasSet.add(noticia.categoria.trim());
      }
    });
    
    this.categorias = Array.from(categoriasSet).sort();
  }

  /**
   * Filtrar noticias por categoría
   */
  filtrarPorCategoria(categoria: string): void {
    this.categoriaSeleccionada = categoria;
    
    if (categoria === 'Todas') {
      this.noticiasFiltradas = [...this.noticias];
    } else {
      this.noticiasFiltradas = this.noticias.filter(
        noticia => noticia.categoria === categoria
      );
    }
    
    console.log(`📂 Filtrando por: ${categoria} - ${this.noticiasFiltradas.length} noticias`);
  }

  /**
   * Contar noticias por categoría
   */
  contarPorCategoria(categoria: string): number {
    return this.noticias.filter(
      noticia => noticia.categoria === categoria
    ).length;
  }

  /**
   * Formatear fecha
   */
  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    
    const fechaObj = new Date(fecha);
    const opciones: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    return fechaObj.toLocaleDateString('es-MX', opciones);
  }

  /**
   * Truncar texto
   */
  truncarTexto(texto: string, maxLength: number): string {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    
    return texto.substring(0, maxLength).trim() + '...';
  }

  /**
   * Abrir noticia en modal
   */
  abrirNoticia(noticia: Noticia, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.noticiaSeleccionada = noticia;
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
    
    console.log('📰 Noticia abierta:', noticia);
  }

  /**
   * Cerrar modal
   */
  cerrarModal(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.noticiaSeleccionada = null;
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
    
    console.log('❌ Modal cerrado');
  }

  irADetalle(noticia: Noticia, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.cerrarModal();
    this.router.navigate(['/noticias', noticia.id_noticia]);
  }

  /**
   * Reproducir video al hacer hover
   */
  playVideo(event: Event): void {
    const video = event.target as HTMLVideoElement;
    if (video && video.tagName === 'VIDEO') {
      video.play().catch(err => {
        console.log('No se pudo reproducir el video:', err);
      });
    }
  }

  /**
   * Pausar video al quitar hover
   */
  pauseVideo(event: Event): void {
    const video = event.target as HTMLVideoElement;
    if (video && video.tagName === 'VIDEO') {
      video.pause();
      video.currentTime = 0;
    }
  }
}
