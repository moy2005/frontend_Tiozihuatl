import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../../api/environments/environment.prod';
import * as pdfjsLib from 'pdfjs-dist';

@Component({
  selector: 'app-visor-libro',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './visor-libro.component.html',
  styleUrls: ['./visor-libro.component.css']
})
export class VisorLibroComponent implements OnInit, OnDestroy {

  pdfDoc: any = null;
  pageNum = 1;
  totalPages = 0;
  paginas: number[] = [];
  scale = 1.0;
  renderScale = 1.2;
  libroId!: string;
  tituloLibro = '';
  cargando = true;

  private scrollHandler: any;
  private resizeTimeout: any;
  private renderTasks: Map<number, any> = new Map();
  private renderVersion = 0;
  private platformId = inject(PLATFORM_ID);

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

    this.libroId = this.route.snapshot.paramMap.get('id')!;
    this.cargarPdf();

    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        if (this.pdfDoc) {
          this.ajustarScale();
          this.limpiarCanvasRendereados(); 
          this.renderTodasLasPaginas();
        }
      }, 300);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.resizeTimeout);
    this.renderTasks.forEach((task) => {
      try { task.cancel(); } catch (e) {}
    });
    this.renderTasks.clear();
    window.removeEventListener('scroll', this.scrollHandler);
  }

  cargarPdf() {
    const token = localStorage.getItem('accessToken');

    fetch(`${environment.apiUrl}/catalog/libros/${this.libroId}/pdf-url`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(({ url, titulo }) => {
      this.tituloLibro = titulo || `Libro ${this.libroId}`;
      const loadingTask = pdfjsLib.getDocument({ url });
      loadingTask.promise.then((pdf: any) => {
        this.pdfDoc = pdf;
        this.totalPages = pdf.numPages;
        this.paginas = Array.from({ length: this.totalPages }, (_, i) => i + 1);
        this.cargando = false;
        setTimeout(() => {
          this.ajustarScale();
          this.renderTodasLasPaginas();
          this.escucharScroll();
        }, 100);
      });
    })
    .catch(err => {
      console.error('Error:', err);
      this.cargando = false;
    });
  }

  ajustarScale() {
    const padding = window.innerWidth < 600 ? 16 : 32;
    const anchoDisponible = Math.min(window.innerWidth - padding, 860);
    const dpr = window.devicePixelRatio || 1;
    const divisor = window.innerWidth < 600 ? 500 : 595;
    this.renderScale = (anchoDisponible / divisor) * dpr;
    this.scale = 1.0;
  }

  limpiarCanvasRendereados() {
    for (let i = 1; i <= this.totalPages; i++) {
      const canvas = document.getElementById(`page-${i}`);
      if (canvas) canvas.removeAttribute('data-rendered');
    }
  }

  renderTodasLasPaginas() {
    this.renderVersion++;
    const currentVersion = this.renderVersion;

    setTimeout(() => {
      // ✅ Solo renderiza página actual + 2 adelante + 1 atrás
      const inicio = Math.max(1, this.pageNum - 1);
      const fin = Math.min(this.totalPages, this.pageNum + 2);

      for (let i = inicio; i <= fin; i++) {
        this.renderPagina(i, currentVersion);
      }
    }, 50);
  }

  renderPagina(num: number, version?: number) {
    const v = version ?? this.renderVersion;

    this.pdfDoc.getPage(num).then((page: any) => {
      if (v !== this.renderVersion) return;

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: this.renderScale });
      const canvas: any = document.getElementById(`page-${num}`);
      if (!canvas) return;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const anchoVisual = viewport.width / dpr;
      const anchoMax = window.innerWidth - (window.innerWidth < 600 ? 16 : 32);
      const anchoFinal = Math.min(anchoVisual, anchoMax);
      const ratio = anchoFinal / anchoVisual;
      const alturaFinal = (viewport.height / dpr) * ratio;

      canvas.style.width = anchoFinal + 'px';
      canvas.style.height = alturaFinal + 'px';

      const task = page.render({ canvasContext: context, viewport });
      this.renderTasks.set(num, task);

      task.promise
        .then(() => {
          this.renderTasks.delete(num);
          // ✅ Marcar como renderizado
          const c = document.getElementById(`page-${num}`);
          if (c) c.setAttribute('data-rendered', 'true');
        })
        .catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.error('Error render página', num, err);
          }
          this.renderTasks.delete(num);
        });
    });
  }

  zoomIn() {
    if (this.scale >= 1.5) return;
    this.scale = Math.round((this.scale + 0.1) * 10) / 10;
    this.rerenderConZoom();
  }

  zoomOut() {
    if (this.scale <= 0.5) return;
    this.scale = Math.round((this.scale - 0.1) * 10) / 10;
    this.rerenderConZoom();
  }

  rerenderConZoom() {
    this.limpiarCanvasRendereados();
    this.renderVersion++;
    const currentVersion = this.renderVersion;
    const inicio = Math.max(1, this.pageNum - 1);
    const fin = Math.min(this.totalPages, this.pageNum + 2);
    for (let i = inicio; i <= fin; i++) {
      this.renderPaginaConZoom(i, currentVersion);
    }
  }

  renderPaginaConZoom(num: number, version?: number) {
    const v = version ?? this.renderVersion;

    this.pdfDoc.getPage(num).then((page: any) => {
      if (v !== this.renderVersion) return;

      const dpr = window.devicePixelRatio || 1;
      const escalaFinal = this.renderScale * this.scale;
      const viewport = page.getViewport({ scale: escalaFinal });
      const canvas: any = document.getElementById(`page-${num}`);
      if (!canvas) return;

      const offscreen = document.createElement('canvas');
      offscreen.height = viewport.height;
      offscreen.width = viewport.width;
      const context = offscreen.getContext('2d');

      const task = page.render({ canvasContext: context, viewport });
      this.renderTasks.set(num, task);

      task.promise.then(() => {
        if (v !== this.renderVersion) return;
        this.renderTasks.delete(num);

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const anchoVisual = viewport.width / dpr;
        const anchoMax = window.innerWidth - (window.innerWidth < 600 ? 16 : 32);
        const anchoFinal = Math.min(anchoVisual, anchoMax);
        const ratio = anchoFinal / anchoVisual;
        const alturaFinal = (viewport.height / dpr) * ratio;

        canvas.style.width = anchoFinal + 'px';
        canvas.style.height = alturaFinal + 'px';
        canvas.getContext('2d').drawImage(offscreen, 0, 0);
        canvas.setAttribute('data-rendered', 'true');
      }).catch((err: any) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error zoom página', num, err);
        }
        this.renderTasks.delete(num);
      });
    });
  }

  escucharScroll() {
    this.scrollHandler = () => {
      for (let i = 1; i <= this.totalPages; i++) {
        const canvas = document.getElementById(`page-${i}`);
        if (!canvas) continue;
        const rect = canvas.getBoundingClientRect();
        if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
          if (this.pageNum !== i) {
            this.pageNum = i;

            this.preRenderizarCercanas(i);
          }
          break;
        }
      }
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  preRenderizarCercanas(paginaActual: number) {
  const currentVersion = this.renderVersion;
  const inicio = Math.max(1, paginaActual - 1);
  const fin = Math.min(this.totalPages, paginaActual + 2);

  for (let i = inicio; i <= fin; i++) {
    const canvas = document.getElementById(`page-${i}`);
    if (!canvas) continue;

    if (canvas.getAttribute('data-rendered') !== 'true' && 
        !this.renderTasks.has(i)) {
      this.renderPagina(i, currentVersion);
    }
  }
}

  nextPage() {
    if (this.pageNum >= this.totalPages) return;
    this.pageNum++;
    this.scrollAPagina(this.pageNum);
  }

  prevPage() {
    if (this.pageNum <= 1) return;
    this.pageNum--;
    this.scrollAPagina(this.pageNum);
  }

  scrollAPagina(num: number) {
    const canvas = document.getElementById(`page-${num}`);
    if (canvas) {
      canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  isMobile(): boolean {
    return window.innerWidth < 600;
  }
}
