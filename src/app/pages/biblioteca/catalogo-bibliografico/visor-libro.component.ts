import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../../api/environments/environment.prod';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js'

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

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.libroId = this.route.snapshot.paramMap.get('id')!;
    this.cargarPdf();
  }

  ngOnDestroy(): void {
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
    this.renderScale = (anchoDisponible / 595) * dpr;
    this.scale = 1.0;
  }
    renderTodasLasPaginas() {
      for (let i = 1; i <= this.totalPages; i++) {
        this.renderPagina(i);
      }
  }

  renderPagina(num: number) {
  this.pdfDoc.getPage(num).then((page: any) => {
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: this.renderScale });
    const canvas: any = document.getElementById(`page-${num}`);
    if (!canvas) return;
    const context = canvas.getContext('2d');

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    // ✅ Tamaño visual base sin zoom
    canvas.style.width = (viewport.width / dpr) + 'px';
    canvas.style.height = (viewport.height / dpr) + 'px';

    page.render({ canvasContext: context, viewport });
    });
  }

  zoomIn() {
    if (this.scale >= 2.0) return;
    this.scale = Math.round((this.scale + 0.1) * 10) / 10;
    this.rerenderConZoom();
  }

  zoomOut() {
    if (this.scale <= 0.5) return;
    this.scale = Math.round((this.scale - 0.1) * 10) / 10;
    this.rerenderConZoom();
  }
  rerenderConZoom() {
    // En lugar de CSS transform, re-renderiza con escala ajustada
    for (let i = 1; i <= this.totalPages; i++) {
      this.renderPaginaConZoom(i);
    }
  }

renderPaginaConZoom(num: number) {
  this.pdfDoc.getPage(num).then((page: any) => {
    const dpr = window.devicePixelRatio || 1;
    const escalaFinal = this.renderScale * this.scale;
    const viewport = page.getViewport({ scale: escalaFinal });
    const canvas: any = document.getElementById(`page-${num}`);
    if (!canvas) return;

    // Canvas temporal fuera de pantalla
    const offscreen = document.createElement('canvas');
    offscreen.height = viewport.height;
    offscreen.width = viewport.width;

    const context = offscreen.getContext('2d');

    page.render({ canvasContext: context, viewport }).promise.then(() => {
      // Solo cuando terminó de renderizar, actualizamos el canvas visible
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = (viewport.width / dpr) + 'px';
      canvas.style.height = (viewport.height / dpr) + 'px';
      canvas.getContext('2d').drawImage(offscreen, 0, 0);
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
          this.pageNum = i;
          break;
        }
      }
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
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
}
