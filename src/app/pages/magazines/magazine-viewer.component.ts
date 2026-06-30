import { ChangeDetectorRef, Component, OnDestroy, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';
import { MagazinesService } from '../../api/services/magazines.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

@Component({
  selector: 'app-magazine-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './magazine-viewer.component.html',
  styleUrls: ['./magazine-viewer.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class MagazineViewerComponent implements OnInit, OnDestroy {
  private magazineService = inject(MagazinesService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  magazineId!: number;
  magazine: any;

  pdfDoc: any;
  pdfUrl = '';

  zoomLevel = 1;
  readonly minZoom = 0.5;
  readonly maxZoom = 2.5;
  readonly zoomStep = 0.1;

  loading = false;
  loadingMessage = 'Cargando revista...';
  rendering = false;
  errorMessage: string | null = null;

  currentPage = 1;
  totalPages = 0;

  private scrollHandler = () => this.updateCurrentPageFromScroll();
  private resizeHandler = () => this.updateCurrentPageFromScroll();

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    const id = this.route.snapshot.paramMap.get('id');

    if (!id || isNaN(Number(id))) {
      this.errorMessage = 'ID invalido';
      return;
    }

    this.magazineId = Number(id);
    this.loadMagazineInfo();
    this.loadPdf();
  }

  loadMagazineInfo(): void {
    this.magazineService.getById(this.magazineId).subscribe({
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
    this.loadingMessage = 'Cargando revista...';
    this.errorMessage = null;

    this.magazineService.getSecurePdf(this.magazineId).subscribe({
      next: async (res: { url: string }) => {
        this.pdfUrl = res.url;

        try {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          await this.initializePdf(this.pdfUrl);
        } catch (error) {
          this.loading = false;
          this.rendering = false;
          this.errorMessage = 'No se pudo abrir el PDF de esta revista.';
          console.error('Error renderizando PDF:', error);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.status === 403
          ? 'Debes comprar esta revista.'
          : 'Error al cargar el PDF.';
      }
    });
  }

  async initializePdf(url: string): Promise<void> {
    this.errorMessage = null;
    this.rendering = true;
    this.loading = true;
    this.loadingMessage = 'Preparando revista...';
    this.cdr.detectChanges();

    if (!this.pdfDoc) {
      this.pdfDoc = await pdfjsLib.getDocument({
        url,
        withCredentials: false
      }).promise;
    }

    this.totalPages = this.pdfDoc.numPages;

    const container = document.getElementById('pdfContainer');
    if (!container) {
      this.rendering = false;
      return;
    }

    container.innerHTML = '';
    await new Promise((resolve) => requestAnimationFrame(resolve));

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      if (pageNum === 1) {
        this.loadingMessage = 'Renderizando primera pagina...';
        this.cdr.detectChanges();
      }

      const page = await this.pdfDoc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: this.getFitScale(baseViewport.width) * this.zoomLevel
      });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) continue;

      const dpr = window.devicePixelRatio || 1;

      canvas.setAttribute('data-page', String(pageNum));
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.style.borderRadius = '8px';
      canvas.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
      canvas.style.background = 'white';

      container.appendChild(canvas);

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      this.drawWatermark(canvas, context, dpr);

      if (pageNum === 1) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }

    this.loading = false;
    this.rendering = false;
    this.setupScrollTracking();
    this.scrollToPage(this.currentPage, 'auto');
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  async zoomIn(): Promise<void> {
    if (this.rendering || this.zoomLevel >= this.maxZoom) return;
    this.zoomLevel = Math.min(this.maxZoom, Number((this.zoomLevel + this.zoomStep).toFixed(2)));
    await this.reloadPdf();
  }

  async zoomOut(): Promise<void> {
    if (this.rendering || this.zoomLevel <= this.minZoom) return;
    this.zoomLevel = Math.max(this.minZoom, Number((this.zoomLevel - this.zoomStep).toFixed(2)));
    await this.reloadPdf();
  }

  async reloadPdf(): Promise<void> {
    if (!this.pdfUrl || !this.pdfDoc) return;

    const pageToKeep = this.currentPage;
    const container = document.getElementById('pdfContainer');
    if (container) container.innerHTML = '';

    this.currentPage = pageToKeep;
    this.loadingMessage = 'Ajustando vista...';
    await this.initializePdf(this.pdfUrl);
  }

  toggleFullscreen(): void {
    const elem = document.documentElement;

    if (!document.fullscreenElement) {
      elem.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  private getFitScale(pageWidth: number): number {
    const horizontalPadding = window.innerWidth < 600 ? 16 : 32;
    const maxReaderWidth = 900;
    const availableWidth = Math.max(
      280,
      Math.min(window.innerWidth - horizontalPadding, maxReaderWidth)
    );

    return availableWidth / pageWidth;
  }

  private setupScrollTracking(): void {
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    requestAnimationFrame(() => this.updateCurrentPageFromScroll());
  }

  private goToPage(pageNumber: number): void {
    const targetPage = Math.min(Math.max(pageNumber, 1), this.totalPages || 1);
    this.currentPage = targetPage;
    this.scrollToPage(targetPage);
  }

  private scrollToPage(pageNumber: number, behavior: ScrollBehavior = 'smooth'): void {
    const page = document.querySelector(`[data-page="${pageNumber}"]`);
    if (!page) return;

    const rect = page.getBoundingClientRect();
    const toolbarOffset = 120;
    const top = window.scrollY + rect.top - toolbarOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior
    });
  }

  private updateCurrentPageFromScroll(): void {
    if (this.rendering) return;

    const container = document.getElementById('pdfContainer');
    if (!container) return;

    const pages = Array.from(container.querySelectorAll('canvas'));
    if (!pages.length) return;

    const viewportCenter = window.innerHeight / 2;
    let closestPage = this.currentPage;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const page of pages) {
      const rect = page.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

      const pageCenter = rect.top + rect.height / 2;
      const distance = Math.abs(pageCenter - viewportCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = Number(page.getAttribute('data-page')) || closestPage;
      }
    }

    this.currentPage = closestPage;
  }

  private drawWatermark(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number): void {
    let user: any = {};

    if (typeof window !== 'undefined') {
      user = JSON.parse(localStorage.getItem('user') || '{}');
    }

    ctx.save();
    ctx.font = '22px Arial';
    ctx.fillStyle = 'rgba(150,150,150,0.12)';
    ctx.textAlign = 'center';
    ctx.translate(canvas.width / (2 * dpr), canvas.height / (2 * dpr));
    ctx.rotate(-0.5);
    ctx.fillText(`${user?.nombre || 'Usuario'} - ${new Date().toLocaleString()}`, 0, 0);
    ctx.restore();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);

    const container = document.getElementById('pdfContainer');
    if (container) container.innerHTML = '';
  }
}
