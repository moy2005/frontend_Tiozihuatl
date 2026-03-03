import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MagazinesService } from '../../api/services/magazines.service';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();

@Component({
  selector: 'app-magazine-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './magazine-viewer.component.html',
  styleUrls: ['./magazine-viewer.component.css']
})
export class MagazineViewerComponent implements OnInit, OnDestroy {

  magazineId!: number;
  magazine: any;

  pdfDoc: any;
  pdfUrl!: string;

  zoomLevel = 1.4;
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
          await this.initializePdf(this.pdfUrl);
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

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {

      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.zoomLevel });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;

      canvas.setAttribute('data-page', pageNum.toString());
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      canvas.style.marginBottom = '40px';
      canvas.style.borderRadius = '8px';
      canvas.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';
      canvas.style.background = 'white';

      container.appendChild(canvas);

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      this.drawWatermark(canvas, context);
    }

    this.setupScrollTracking();

    this.loading = false;
  }

  setupScrollTracking() {

    const container = document.getElementById('pdfContainer')!;
    const canvases = container.querySelectorAll('canvas');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const page = Number(entry.target.getAttribute('data-page'));
            this.currentPage = page;
          }
        });
      },
      { threshold: 0.6 }
    );

    canvases.forEach(canvas => observer.observe(canvas));
  }

  drawWatermark(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {

    const user = JSON.parse(localStorage.getItem('user') || '{}');

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
    if (this.zoomLevel > 0.6) {
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
    const container = document.getElementById('pdfContainer');
    if (container) container.innerHTML = '';
  }
}