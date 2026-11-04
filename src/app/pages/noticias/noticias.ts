import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NewsService } from '../../api/services/news.service';

interface Noticia {
  id_noticia: number;
  titulo: string;
  contenido: string;
  imagen_url?: string | null;
  video_url?: string | null;
  categoria?: string | null;
  fecha_publicacion: string;
}

interface FiltroNoticia {
  key: string;
  label: string;
  icon: string;
}

const TODAS = 'Todas';

/** Listado público de noticias con el mismo diseño que el de eventos (eventos.css). */
@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './noticias.html',
  styleUrls: ['../eventos/eventos.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NoticiasComponent implements OnInit {
  cargandoNoticias = false;
  noticias: Noticia[] = [];
  noticiasFiltradas: Noticia[] = [];
  filtros: FiltroNoticia[] = [{ key: TODAS, label: 'Todas', icon: 'ph-squares-four' }];
  filtroSeleccionado = TODAS;

  constructor(
    private newsService: NewsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarNoticias();
  }

  async cargarNoticias(): Promise<void> {
    this.cargandoNoticias = true;

    try {
      const noticias = await firstValueFrom(this.newsService.getPublicNews());
      this.noticias = Array.isArray(noticias) ? (noticias as Noticia[]) : [];
      const categorias = [...new Set(this.noticias.map((n) => n.categoria?.trim()).filter((c): c is string => !!c))]
        .sort((a, b) => a.localeCompare(b, 'es'));
      this.filtros = [
        { key: TODAS, label: 'Todas', icon: 'ph-squares-four' },
        ...categorias.map((categoria) => ({ key: categoria, label: categoria, icon: 'ph-tag' })),
      ];
      this.aplicarFiltro(this.filtroSeleccionado);
    } catch (error) {
      console.error('Error al cargar noticias públicas:', error);
      this.noticias = [];
      this.noticiasFiltradas = [];
    } finally {
      this.cargandoNoticias = false;
    }
  }

  aplicarFiltro(filtro: string): void {
    this.filtroSeleccionado = this.filtros.some((f) => f.key === filtro) ? filtro : TODAS;
    this.noticiasFiltradas = this.filtroSeleccionado === TODAS
      ? [...this.noticias]
      : this.noticias.filter((n) => n.categoria?.trim() === this.filtroSeleccionado);
  }

  contarPorFiltro(filtro: string): number {
    return filtro === TODAS
      ? this.noticias.length
      : this.noticias.filter((n) => n.categoria?.trim() === filtro).length;
  }

  irADetalle(noticia: Noticia, event?: Event): void {
    event?.preventDefault();
    this.router.navigate(['/noticias', noticia.id_noticia]);
  }

  formatearFechaCorta(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  truncarTexto(texto: string | null | undefined, maxLength = 140): string {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return `${texto.slice(0, maxLength).trim()}...`;
  }
}
