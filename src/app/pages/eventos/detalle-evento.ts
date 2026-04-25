import {
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule, ViewportScroller } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EventsService } from '../../api/services/events.service';

interface EventoImagenDetalle {
  id_imagen?: number;
  url: string;
  orden?: number;
}

interface EventoDetalle {
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
  imagenes?: EventoImagenDetalle[];
}

@Component({
  selector: 'app-detalle-evento',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detalle-evento.html',
  styleUrls: ['./detalle-evento.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DetalleEventoComponent implements OnInit {
  cargando = true;
  evento: EventoDetalle | null = null;
  noEncontrado = false;

  galeria: EventoImagenDetalle[] = [];
  imagenActiva = 0;
  visorAbierto = false;

  @ViewChild('imgPrincipal') imgPrincipalRef?: ElementRef<HTMLImageElement>;
  @ViewChild('thumbStrip') thumbStripRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('thumbItem') thumbItems?: QueryList<ElementRef<HTMLDivElement>>;

  constructor(
    private route: ActivatedRoute,
    private eventsService: EventsService,
    private cdr: ChangeDetectorRef,
    private viewportScroller: ViewportScroller,
  ) {}

  ngOnInit(): void {
    this.cargarDetalle();
  }

  async cargarDetalle(): Promise<void> {
    this.cargando = true;
    this.noEncontrado = false;

    try {
      const id = Number(this.route.snapshot.paramMap.get('id'));

      if (!Number.isInteger(id) || id <= 0) {
        this.noEncontrado = true;
        return;
      }

      const evento = await firstValueFrom(this.eventsService.getPublicEventById(id));
      this.evento = evento || null;
      this.noEncontrado = !this.evento;

      if (this.evento) {
        this.galeria = this.obtenerGaleria();
        this.imagenActiva = 0;
        this.visorAbierto = false;
      }
    } catch (error: any) {
      console.error('Error al cargar detalle del evento:', error);
      this.noEncontrado = error?.status === 404;
      this.evento = null;
    } finally {
      this.cargando = false;
    }
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';

    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  obtenerGaleria(): EventoImagenDetalle[] {
    if (!this.evento) return [];

    if (this.evento.imagenes?.length) {
      return [...this.evento.imagenes].sort(
        (a, b) => Number(a.orden || 0) - Number(b.orden || 0),
      );
    }

    if (this.evento.imagen_principal) {
      return [{ url: this.evento.imagen_principal, orden: 1 }];
    }

    return [];
  }

  esDestacado(): boolean {
    return (
      this.evento?.destacado === true ||
      this.evento?.destacado === 1 ||
      this.evento?.destacado === '1' ||
      this.evento?.destacado === 'true'
    );
  }

  abrirVisor(index: number): void {
    this.imagenActiva = index;
    this.visorAbierto = true;
    this.cdr.detectChanges();
    this.viewportScroller.scrollToPosition([0, 0]);

    setTimeout(() => this.scrollThumbIntoView(index), 50);
  }

  cerrarVisor(): void {
    this.visorAbierto = false;
    this.cdr.detectChanges();

    setTimeout(() => this.viewportScroller.scrollToAnchor('galeria'), 0);
  }

  irAImagen(index: number): void {
    if (index < 0 || index >= this.galeria.length || index === this.imagenActiva) return;

    const imgEl = this.imgPrincipalRef?.nativeElement;

    if (imgEl) {
      imgEl.classList.add('is-exiting');

      setTimeout(() => {
        this.imagenActiva = index;
        this.cdr.detectChanges();

        imgEl.classList.remove('is-exiting');
        imgEl.classList.add('is-entering');

        requestAnimationFrame(() => {
          imgEl.classList.remove('is-entering');
        });

        this.scrollThumbIntoView(index);
      }, 180);
    } else {
      this.imagenActiva = index;
      this.cdr.detectChanges();
      this.scrollThumbIntoView(index);
    }
  }

  onImageLoad(): void {
    const imgEl = this.imgPrincipalRef?.nativeElement;
    if (imgEl) {
      imgEl.classList.remove('is-entering', 'is-exiting');
    }
  }

  private scrollThumbIntoView(index: number): void {
    const strip = this.thumbStripRef?.nativeElement;
    const thumbEls = this.thumbItems?.toArray();

    if (!strip || !thumbEls?.[index]) return;

    const thumb = thumbEls[index].nativeElement;
    const offset = thumb.offsetLeft - strip.offsetWidth / 2 + thumb.offsetWidth / 2;
    strip.scrollTo({ left: offset, behavior: 'smooth' });
  }
}
