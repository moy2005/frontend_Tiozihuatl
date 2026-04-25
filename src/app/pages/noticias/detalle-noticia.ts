import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NewsService } from '../../api/services/news.service';

interface NoticiaDetalle {
  id_noticia: number;
  titulo: string;
  contenido: string;
  imagen_url?: string | null;
  video_url?: string | null;
  categoria?: string | null;
  fecha_publicacion: string;
}

@Component({
  selector: 'app-detalle-noticia',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detalle-noticia.html',
  styleUrls: ['./detalle-noticia.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DetalleNoticiaComponent implements OnInit {
  cargando = true;
  noticia: NoticiaDetalle | null = null;
  noEncontrado = false;

  constructor(
    private route: ActivatedRoute,
    private newsService: NewsService
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

      const noticia = await firstValueFrom(this.newsService.getPublicNewsById(id));
      this.noticia = noticia || null;
      this.noEncontrado = !this.noticia;
    } catch (error: any) {
      console.error('Error al cargar detalle de noticia:', error);
      this.noEncontrado = error?.status === 404;
      this.noticia = null;
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
}
