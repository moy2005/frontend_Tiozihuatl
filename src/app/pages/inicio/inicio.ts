import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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
export class InicioComponent implements OnInit {
  noticias: NoticiaDetectada[] = [];
  noticiasRender: NewsRenderGroup[] = [];
  eventosPreview: EventoHomeDetectado[] = [];
  cargandoNoticias = true;
  cargandoEventos = true;

  constructor(
    private newsService: NewsService,
    private eventsService: EventsService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarNoticias(), this.cargarEventos()]);
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
