import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EventsService } from '../../api/services/events.service';

interface EventoImagenPublica {
  id_imagen?: number;
  url: string;
  orden?: number;
}

interface EventoPublico {
  id_evento: number;
  titulo: string;
  descripcion: string;
  tipo: 'PRESENCIAL' | 'VIRTUAL';
  ubicacion?: string | null;
  enlace?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'Publicado' | 'Finalizado';
  destacado?: boolean | number | string;
  imagen_principal?: string | null;
  imagenes?: EventoImagenPublica[];
}

type EventMediaKind = 'landscape' | 'portrait' | 'square' | 'no-media';

interface EventoPublicoDetectado extends EventoPublico {
  mediaKind: EventMediaKind;
  aspectRatio: number | null;
}

type FiltroEvento =
  | 'Todas'
  | 'Destacados'
  | 'Vigentes'
  | 'Finalizados'
  | 'Presenciales'
  | 'Virtuales';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './eventos.html',
  styleUrls: ['./eventos.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EventosComponent implements OnInit, OnDestroy {
  cargandoEventos = false;
  eventos: EventoPublicoDetectado[] = [];
  eventosFiltrados: EventoPublicoDetectado[] = [];
  filtroSeleccionado: FiltroEvento = 'Todas';
  eventoSeleccionado: EventoPublicoDetectado | null = null;

  readonly filtros: Array<{ key: FiltroEvento; label: string; icon: string }> = [
    { key: 'Todas', label: 'Todos', icon: 'ph-squares-four' },
    { key: 'Destacados', label: 'Destacados', icon: 'ph-star' },
    { key: 'Vigentes', label: 'Vigentes', icon: 'ph-clock' },
    { key: 'Finalizados', label: 'Finalizados', icon: 'ph-check-circle' },
    { key: 'Presenciales', label: 'Presenciales', icon: 'ph-map-pin' },
    { key: 'Virtuales', label: 'Virtuales', icon: 'ph-video-camera' },
  ];

  constructor(
    private eventsService: EventsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarEventos();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  async cargarEventos(): Promise<void> {
    this.cargandoEventos = true;

    try {
      const eventos = await firstValueFrom(this.eventsService.getPublicEvents());
      const listaEventos = Array.isArray(eventos) ? (eventos as EventoPublico[]) : [];
      this.eventos = await Promise.all(
        listaEventos.map((evento) => this.detectarMediaEvento(evento))
      );
      this.aplicarFiltro(this.filtroSeleccionado);
    } catch (error) {
      console.error('Error al cargar eventos publicos:', error);
      this.eventos = [];
      this.eventosFiltrados = [];
    } finally {
      this.cargandoEventos = false;
    }
  }

  aplicarFiltro(filtro: FiltroEvento): void {
    this.filtroSeleccionado = filtro;

    switch (filtro) {
      case 'Destacados':
        this.eventosFiltrados = this.eventos.filter((evento) =>
          this.normalizarBooleano(evento.destacado)
        );
        break;
      case 'Vigentes':
        this.eventosFiltrados = this.eventos.filter((evento) => evento.estado === 'Publicado');
        break;
      case 'Finalizados':
        this.eventosFiltrados = this.eventos.filter((evento) => evento.estado === 'Finalizado');
        break;
      case 'Presenciales':
        this.eventosFiltrados = this.eventos.filter((evento) => evento.tipo === 'PRESENCIAL');
        break;
      case 'Virtuales':
        this.eventosFiltrados = this.eventos.filter((evento) => evento.tipo === 'VIRTUAL');
        break;
      default:
        this.eventosFiltrados = [...this.eventos];
        break;
    }
  }

  contarPorFiltro(filtro: FiltroEvento): number {
    switch (filtro) {
      case 'Destacados':
        return this.eventos.filter((evento) => this.normalizarBooleano(evento.destacado)).length;
      case 'Vigentes':
        return this.eventos.filter((evento) => evento.estado === 'Publicado').length;
      case 'Finalizados':
        return this.eventos.filter((evento) => evento.estado === 'Finalizado').length;
      case 'Presenciales':
        return this.eventos.filter((evento) => evento.tipo === 'PRESENCIAL').length;
      case 'Virtuales':
        return this.eventos.filter((evento) => evento.tipo === 'VIRTUAL').length;
      default:
        return this.eventos.length;
    }
  }

  abrirEvento(evento: EventoPublicoDetectado, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.eventoSeleccionado = evento;
    document.body.style.overflow = 'hidden';
  }

  cerrarModal(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.eventoSeleccionado = null;
    document.body.style.overflow = '';
  }

  irADetalle(evento: EventoPublicoDetectado, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.cerrarModal();
    this.router.navigate(['/eventos', evento.id_evento]);
  }

  obtenerImagenPreview(evento: EventoPublico): string | null {
    return evento.imagen_principal || evento.imagenes?.[0]?.url || null;
  }

  obtenerAspectRatioEventoCss(evento: EventoPublicoDetectado): string {
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

  formatearFecha(fecha: string): string {
    if (!fecha) return '';

    const fechaObj = new Date(fecha);

    return fechaObj.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatearFechaCorta(fecha: string): string {
    if (!fecha) return '';

    const fechaObj = new Date(fecha);

    return fechaObj.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  truncarTexto(texto: string, maxLength = 140): string {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return `${texto.slice(0, maxLength).trim()}...`;
  }

  obtenerEtiquetaTipo(evento: EventoPublico): string {
    return evento.tipo === 'VIRTUAL' ? 'Virtual' : 'Presencial';
  }

  obtenerEtiquetaEstado(evento: EventoPublico): string {
    return evento.estado === 'Finalizado' ? 'Finalizado' : 'Vigente';
  }

  normalizarBooleano(valor: unknown): boolean {
    return valor === true || valor === 1 || valor === '1' || valor === 'true';
  }

  private detectarMediaEvento(evento: EventoPublico): Promise<EventoPublicoDetectado> {
    const imagenUrl = this.obtenerImagenPreview(evento);

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
}
