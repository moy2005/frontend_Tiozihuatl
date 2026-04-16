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

  cancelarRenderActual() {
    this.renderTasks.forEach((task) => {
      try { task.cancel(); } catch {}
    });
    this.renderTasks.clear();
  }
  renderTodasLasPaginas() {
    this.cancelarRenderActual();
    this.renderVersion++;
    const currentVersion = this.renderVersion;

    setTimeout(() => {
      const inicio = Math.max(1, this.pageNum - 1);
      const fin = Math.min(this.totalPages, this.pageNum + 2);

      for (let i = inicio; i <= fin; i++) {
        this.renderPagina(i, currentVersion);
      }
    }, 50);
  }

  renderPagina(num: number, version?: number) {

    const v = version ?? this.renderVersion;

    if (this.renderTasks.has(num)) return;

    this.pdfDoc.getPage(num).then((page: any) => {

      if (v !== this.renderVersion) return;

      const canvas: any = document.getElementById(`page-${num}`);
      if (!canvas) return;

      if (canvas.getAttribute('data-rendered') === 'true') return;

      const context = canvas.getContext('2d');
      if (!context) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const dpr = window.devicePixelRatio || 1;

      const viewport = page.getViewport({
        scale: this.renderScale
      });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const anchoVisual = viewport.width / dpr;
      const anchoMax = window.innerWidth - (window.innerWidth < 600 ? 16 : 32);
      const anchoFinal = Math.min(anchoVisual, anchoMax);
      const ratio = anchoFinal / anchoVisual;
      const alturaFinal = (viewport.height / dpr) * ratio;

      canvas.style.width = anchoFinal + 'px';
      canvas.style.height = alturaFinal + 'px';

      const task = page.render({
        canvasContext: context,
        viewport
      });

      this.renderTasks.set(num, task);

      task.promise
        .then(() => {
          if (v !== this.renderVersion) return;

          this.renderTasks.delete(num);

          canvas.setAttribute('data-rendered', 'true');
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
    this.cancelarRenderActual();
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

    if (this.renderTasks.has(num)) {
      try { this.renderTasks.get(num)?.cancel(); } catch {}
      this.renderTasks.delete(num);
    }

    this.pdfDoc.getPage(num).then((page: any) => {

      if (v !== this.renderVersion) return;

      const canvas: any = document.getElementById(`page-${num}`);
      if (!canvas) return;

      canvas.removeAttribute('data-rendered');
      canvas.width = 0;
      canvas.height = 0;

      const dpr = window.devicePixelRatio || 1;
      const escalaFinal = this.renderScale * this.scale;
      const viewport = page.getViewport({ scale: escalaFinal });
      const offscreen = document.createElement('canvas');
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;

      const ctxOff = offscreen.getContext('2d');
      if (!ctxOff) return;

      ctxOff.setTransform(1, 0, 0, 1, 0, 0);
      ctxOff.clearRect(0, 0, offscreen.width, offscreen.height);

      const task = page.render({
        canvasContext: ctxOff,
        viewport
      });

      this.renderTasks.set(num, task);

      task.promise.then(() => {

        if (v !== this.renderVersion) {
          this.renderTasks.delete(num);
          return;
        }

        this.renderTasks.delete(num);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreen, 0, 0);

        const anchoVisual = viewport.width / dpr;
        const anchoMax = window.innerWidth - (window.innerWidth < 600 ? 16 : 32);
        const anchoFinal = Math.min(anchoVisual, anchoMax);

        const ratio = anchoFinal / anchoVisual;
        const alturaFinal = (viewport.height / dpr) * ratio;

        canvas.style.width = anchoFinal + 'px';
        canvas.style.height = alturaFinal + 'px';

        canvas.setAttribute('data-rendered', 'true');

      }).catch((err: any) => {

        this.renderTasks.delete(num);

        canvas.removeAttribute('data-rendered');

        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error zoom página', num, err);
        }
      });

    });
  }

 escucharScroll() {
  let ticking = false;

  this.scrollHandler = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        this.detectarPaginaVisible();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', this.scrollHandler, { passive: true });
}

 detectarPaginaVisible() {
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
        if (this.scale !== 1.0) {
          this.renderPaginaConZoom(i, currentVersion);
        } else {
          this.renderPagina(i, currentVersion);
        }
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
