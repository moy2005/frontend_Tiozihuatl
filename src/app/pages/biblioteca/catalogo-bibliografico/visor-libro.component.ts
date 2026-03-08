import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../../api/environments/environment.prod';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

@Component({
  selector: 'app-visor-libro',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './visor-libro.component.html',
  styleUrls: ['./visor-libro.component.css']

  
})
export class VisorLibroComponent implements OnInit {

  pdfDoc: any = null;
  pageNum = 1;
  totalPages = 0;
  paginas: number[] = [];   // array [1,2,3...n] para el *ngFor
  scale = 1.2;
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
        // Genera array [1, 2, 3, ... totalPages]
        this.paginas = Array.from({ length: this.totalPages }, (_, i) => i + 1);
        this.cargando = false;

        // Espera a que Angular renderice los canvas y luego pinta las páginas
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
    // ✅ Multiplica por devicePixelRatio para pantallas retina/HD
    const dpr = window.devicePixelRatio || 1;
    this.scale = (anchoDisponible / 595) * dpr;
  }

  // Renderiza todas las páginas en sus canvas
  renderTodasLasPaginas() {
    for (let i = 1; i <= this.totalPages; i++) {
      this.renderPagina(i);
    }
  }

  renderPagina(num: number) {
  this.pdfDoc.getPage(num).then((page: any) => {
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: this.scale });
    const canvas: any = document.getElementById(`page-${num}`);
    if (!canvas) return;
    const context = canvas.getContext('2d');

    // ✅ Tamaño real del canvas en píxeles del dispositivo
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // ✅ Tamaño visual — CSS lo escala al contenedor
    canvas.style.width = (viewport.width / dpr) + 'px';
    canvas.style.height = (viewport.height / dpr) + 'px';

    page.render({ canvasContext: context, viewport });
  });
}
  // Detecta qué página es visible al hacer scroll
  escucharScroll() {
    this.scrollHandler = () => {
      for (let i = 1; i <= this.totalPages; i++) {
        const canvas = document.getElementById(`page-${i}`);
        if (!canvas) continue;
        const rect = canvas.getBoundingClientRect();
        // Si el canvas está visible en pantalla
        if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
          this.pageNum = i;
          break;
        }
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  // Zoom — re-renderiza todas las páginas
  zoomIn() {
    if (this.scale >= 3.0) return;
    this.scale = Math.round((this.scale + 0.2) * 10) / 10;
    this.renderTodasLasPaginas();
  }

  zoomOut() {
    if (this.scale <= 0.6) return;
    this.scale = Math.round((this.scale - 0.2) * 10) / 10;
    this.renderTodasLasPaginas();
  }

  // Los botones ahora hacen scroll hasta la página
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