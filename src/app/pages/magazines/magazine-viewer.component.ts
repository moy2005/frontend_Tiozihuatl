import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule  } from '@angular/router';
import { MagazinesService } from '../../api/services/magazines.service';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;

@Component({
  selector: 'app-magazine-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './magazine-viewer.component.html',
  styleUrls: ['./magazine-viewer.component.css']
})
export class MagazineViewerComponent implements OnInit, OnDestroy {

  magazineId!: number;
  magazine: any;

  pdfDoc: any;
  pdfUrl!: string;

  zoomLevel = 0.5;
  darkMode = true;

  loading = false;
  errorMessage: string | null = null;

  currentPage = 1;
  totalPages = 0;

  constructor(
    private magazineService: MagazinesService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (typeof window === 'undefined') return; //guard SSR
       this.zoomLevel = window.innerWidth < 600 ? 1.0 : 0.6;
    const id = this.route.snapshot.paramMap.get('id');

    if (!id || isNaN(Number(id))) {
      this.errorMessage = 'ID inválido';
      return;
    }

    this.magazineId = Number(id);

    this.loadMagazineInfo();
    this.loadPdf();
  }

  loadMagazineInfo() {
    this.magazineService.getById(this.magazineId)
      .subscribe({
        next: (res: any) => {
          this.magazine = res.data;
        },
        error: () => {
          this.errorMessage = 'Error al cargar la revista';
        }
      });
  }

  loadPdf(): void {

    this.loading = true;
    this.errorMessage = null;

    this.magazineService.getSecurePdf(this.magazineId)
      .subscribe({
        next: async (res: { url: string }) => {
          this.pdfUrl = res.url;
          this.loading = false; // 👈 mover aquí
          requestAnimationFrame(async () => {
            await this.initializePdf(this.pdfUrl);
          });
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage =
            err.status === 403
              ? 'Debes comprar esta revista.'
              : 'Error al cargar el PDF.';
        }
      });
  }

 async initializePdf(url: string) {

  this.pdfDoc = await pdfjsLib.getDocument({
    url,
    withCredentials: false
  }).promise;

  this.totalPages = this.pdfDoc.numPages;

  const container = document.getElementById('pdfContainer')!;
  container.innerHTML = '';

  // 🔥 Esperar a que el DOM tenga tamaño real
  await new Promise(resolve => requestAnimationFrame(resolve));

  for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {

    const page = await this.pdfDoc.getPage(pageNum);

    // 🔥 Obtener ancho real del contenedor
    let containerWidth = container.clientWidth;

    // Si aún es 0 (muy raro pero puede pasar)
    if (!containerWidth || containerWidth < 100) {
      containerWidth = window.innerWidth * 0.9;
    }

    const baseViewport = page.getViewport({ scale: 1 });

    // 🔥 Scale responsivo seguro
    const responsiveScale = Math.max(
      containerWidth / baseViewport.width,
      0.5
    );

    const finalScale = responsiveScale * this.zoomLevel;

    const viewport = page.getViewport({ scale: finalScale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true })!;

    canvas.setAttribute('data-page', pageNum.toString());

    const dpr = window.devicePixelRatio || 1;

    // 🔥 Canvas interno a alta resolución
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;

    // 🔥 Tamaño visual en pantalla
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';

    canvas.style.borderRadius = '8px';
    canvas.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
    canvas.style.background = 'white';

    container.appendChild(canvas);

    // 🔥 Escalar contexto para dpr
    context.scale(dpr, dpr);

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    this.drawWatermark(canvas, context);
  }

  this.setupScrollTracking();
  this.loading = false;
}

  prevPage() {
  const container = document.getElementById('pdfContainer');
  const page = document.querySelector(`[data-page="${this.currentPage - 1}"]`);
  page?.scrollIntoView({ behavior: 'smooth' });
  }

  nextPage() {
    const container = document.getElementById('pdfContainer');
    const page = document.querySelector(`[data-page="${this.currentPage + 1}"]`);
    page?.scrollIntoView({ behavior: 'smooth' });
  }

      setupScrollTracking() {
      // Esperar a que el DOM estabilice las posiciones de los canvas
      setTimeout(() => {
        const container = document.getElementById('pdfContainer')!;
        const canvases = container.querySelectorAll('canvas');

        if ((this as any)._pageObserver) {
          (this as any)._pageObserver.disconnect();
        }

        const observer = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter(e => e.isIntersecting)
              .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

            if (visible.length > 0) {
              const page = Number(visible[0].target.getAttribute('data-page'));
              if (page) this.currentPage = page;
            }
          },
          { root: null, threshold: 0.1, rootMargin: '0px' }
        );

        canvases.forEach(canvas => observer.observe(canvas));
        (this as any)._pageObserver = observer;

        // 🔥 Forzar detección inmediata de la página visible actual
        const firstVisible = Array.from(canvases).find(canvas => {
          const rect = canvas.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0;
        });

        if (firstVisible) {
          const page = Number(firstVisible.getAttribute('data-page'));
          if (page) this.currentPage = page;
        }

      }, 300); // pequeño delay para que el DOM esté listo
    }
  drawWatermark(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
     let user: any = {};
    if (typeof window !== 'undefined') { 
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      }
    ctx.save();
    ctx.font = "22px Arial";
    ctx.fillStyle = "rgba(150,150,150,0.12)";
    ctx.textAlign = "center";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-0.5);

    ctx.fillText(
      `${user?.nombre || 'Usuario'} - ${new Date().toLocaleString()}`,
      0,
      0
    );

    ctx.restore();
  }

  async zoomIn() {
    this.zoomLevel += 0.2;
    await this.reloadPdf();
  }

  async zoomOut() {
    if (this.zoomLevel > 0.4) {
      this.zoomLevel -= 0.2;
      await this.reloadPdf();
    }
  }

  async reloadPdf() {
    const container = document.getElementById('pdfContainer');
    if (container) container.innerHTML = '';
    await this.initializePdf(this.pdfUrl);
  }

  toggleFullscreen() {
    const elem = document.documentElement;

    if (!document.fullscreenElement) {
      elem.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('light-mode');
  }

  ngOnDestroy(): void {
      if ((this as any)._pageObserver) {
      (this as any)._pageObserver.disconnect();
    }
    const container = document.getElementById('pdfContainer');
    if (container) container.innerHTML = '';
  }
}

