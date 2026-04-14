import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialesService } from '../../api/services/materiales.service';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { NgxDocViewerModule, viewerType } from 'ngx-doc-viewer';
import Swal from 'sweetalert2';

// ──────────────────────────────────────────────────────────────
// Ajusta la ruta según tu proyecto. Este servicio debe exponer
// un método getUser() que retorne el usuario logueado con
// al menos: { id_usuario, nombre, id_semestre, ... }
// ──────────────────────────────────────────────────────────────
import { AuthService } from '../../api/services/auth';

@Component({
  selector: 'app-materiales',
  standalone: true,
  templateUrl: './materiales.component.html',
  styleUrls: ['./materiales.component.css'],
  imports: [CommonModule, FormsModule, SafeUrlPipe, NgxDocViewerModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MaterialesComponent implements OnInit {

  // ─────────────────────────────────────────
  // DATOS
  // ─────────────────────────────────────────
  materiales: any[] = [];
  docentes:   any[] = [];
  materias:   any[] = [];
  cargando = false;

  // ─────────────────────────────────────────
  // SEMESTRE DEL ALUMNO (automático, sin filtro visible)
  // ─────────────────────────────────────────
  alumnoSemestre: string | number = '';

  // ─────────────────────────────────────────
  // FILTROS (sin semestre — ya es automático)
  // ─────────────────────────────────────────
  search          = '';
  selectedDocente = '';
  selectedTipo    = '';
  selectedMateria = '';

  tiposArchivo = [
    { label: 'Todos los tipos', value: '' },
    { label: 'PDF',             value: 'PDF'    },
    { label: 'VIDEO',           value: 'VIDEO'  },
    { label: 'IMAGEN',          value: 'IMAGEN' },
    { label: 'WORD',            value: 'WORD'   },
    { label: 'EXCEL',           value: 'EXCEL'  },
    { label: 'PPT',             value: 'PPT'    }
  ];

  // ─────────────────────────────────────────
  // PAGINACIÓN
  // ─────────────────────────────────────────
  currentPage  = 1;
  totalPages   = 1;
  totalItems   = 0;
  limit        = 9;

  // ─────────────────────────────────────────
  // MODAL
  // ─────────────────────────────────────────
  modalAbierto         = false;
  materialSeleccionado: any = null;
  zoomActivo           = false;
  iframeLoading        = true;

  constructor(
    private service:     MaterialesService,
    private authService: AuthService        // ← inyecta tu servicio de auth
  ) {}

  ngOnInit() {
    const user = this.authService.getStoredUser();
    this.alumnoSemestre = user?.id_semestre ?? '';

    this.cargarCatalogos();
    this.cargarMateriales();
  }

  // ─────────────────────────────────────────
  // CARGAS
  // ─────────────────────────────────────────

  cargarCatalogos() {
    this.service.getDocentes().subscribe((res: any) => this.docentes = res);
    this.service.getMaterias().subscribe((res: any) => this.materias = res);
    // Ya no se carga catálogo de semestres — no hay filtro visible
  }

  cargarMateriales(resetPage = false) {
    if (resetPage) this.currentPage = 1;

    this.cargando = true;

    const filters = {
      search:   this.search,
      docente:  this.selectedDocente,
      tipo:     this.selectedTipo,
      materia:  this.selectedMateria,
      semestre: this.alumnoSemestre,   // ← automático según el alumno
      page:     this.currentPage,
      limit:    this.limit
    };

    this.service.getAllMateriales(filters).subscribe({
      next: (res) => {
        this.materiales  = res.data;
        this.totalItems  = res.total;
        this.totalPages  = res.totalPages;
        this.currentPage = res.page;
        this.cargando    = false;
      },
      error: () => { this.cargando = false; }
    });
  }

  // ─────────────────────────────────────────
  // PAGINACIÓN
  // ─────────────────────────────────────────

  irAPagina(page: number) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.cargarMateriales();
    // Scroll suave al inicio del contenido
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get paginasVisibles(): number[] {
    const pages: number[] = [];
    const delta = 2;
    for (let i = Math.max(1, this.currentPage - delta);
             i <= Math.min(this.totalPages, this.currentPage + delta); i++) {
      pages.push(i);
    }
    return pages;
  }

  // ─────────────────────────────────────────
  // FILTROS
  // ─────────────────────────────────────────

  limpiarFiltros() {
    this.search         = '';
    this.selectedDocente = '';
    this.selectedTipo    = '';
    this.selectedMateria  = '';
    this.cargarMateriales(true);
  }

  get filtrosActivos(): { key: string; label: string }[] {
    const arr: { key: string; label: string }[] = [];
    if (this.selectedDocente) {
      const d = this.docentes.find(x => x.id_usuario == this.selectedDocente);
      arr.push({ key: 'docente', label: d?.nombre ?? 'Docente' });
    }
    if (this.selectedTipo)
      arr.push({ key: 'tipo', label: this.selectedTipo });
    if (this.selectedMateria) {
      const m = this.materias.find(x => x.id == this.selectedMateria);
      arr.push({ key: 'materia', label: m?.nombre ?? 'Materia' });
    }
    return arr;
  }

  quitarFiltro(key: string) {
    if (key === 'docente') this.selectedDocente = '';
    if (key === 'tipo')    this.selectedTipo    = '';
    if (key === 'materia') this.selectedMateria = '';
    this.cargarMateriales(true);
  }

  // ─────────────────────────────────────────
  // MODAL
  // ─────────────────────────────────────────

  abrirModal(material: any) {
    this.materialSeleccionado = material;
    this.modalAbierto         = true;
    this.iframeLoading        = true;
    this.zoomActivo           = false;
  }

  cerrarModal() {
    this.modalAbierto         = false;
    this.materialSeleccionado = null;
    this.zoomActivo           = false;
  }

  toggleZoom() { this.zoomActivo = !this.zoomActivo; }

  // ─────────────────────────────────────────
  // VISOR — ngx-doc-viewer
  // ─────────────────────────────────────────

  getViewerType(tipo: string): viewerType {
    switch (tipo?.toUpperCase()) {
      case 'PDF':   return 'google';
      case 'WORD':
      case 'EXCEL':
      case 'PPT':   return 'office';
      default:      return 'url';
    }
  }

  getViewerUrl(url: string, tipo: string): string {
    let cleanUrl = url.split('?')[0];
    const extensiones: Record<string, string> = {
      WORD:  '.docx',
      EXCEL: '.xlsx',
      PPT:   '.pptx',
      PDF:   '.pdf'
    };
    const ext = extensiones[tipo?.toUpperCase()];
    if (ext && !cleanUrl.endsWith(ext)) cleanUrl += ext;
    return cleanUrl;
  }

  // ─────────────────────────────────────────
  // DESCARGA
  // ─────────────────────────────────────────

  descargar(url: string, titulo: string, tipo: string, event: Event) {
    event.stopPropagation();
    if (!url) return;

    let urlDescarga = url;
    if (url.includes('/upload/')) {
      urlDescarga = url.replace('/upload/', '/upload/fl_attachment/');
    }

    let nombreArchivo = titulo
      ?.trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-\.]/g, '') || 'archivo';

    const extensiones: Record<string, string> = {
      PDF: 'pdf', PPT: 'pptx', PPTX: 'pptx',
      XLS: 'xlsx', XLSX: 'xlsx', WORD: 'docx',
      DOC: 'docx', DOCX: 'docx', IMAGEN: 'jpg', VIDEO: 'mp4'
    };
    const extension = extensiones[tipo?.toUpperCase()] || '';
    if (extension && !nombreArchivo.endsWith(`.${extension}`)) {
      nombreArchivo += `.${extension}`;
    }

    fetch(urlDescarga)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = nombreArchivo;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        Swal.fire({
          toast: true, position: 'bottom-end', icon: 'success',
          title: 'Descarga completada', showConfirmButton: false, timer: 2000
        });
      })
      .catch(() => {
        Swal.fire({ icon: 'error', title: 'Error al descargar', text: 'No se pudo descargar el archivo' });
      });
  }

  abrirEnNuevaPestana(url: string) { window.open(url, '_blank'); }

  // ─────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────

  getClaseTipo(tipo: string): string {
    return ({
      PDF:    'tipo-pdf',
      VIDEO:  'tipo-video',
      IMAGEN: 'tipo-imagen',
      WORD:   'tipo-doc',
      EXCEL:  'tipo-excel',
      PPT:    'tipo-ppt'
    } as Record<string, string>)[tipo] || 'tipo-otro';
  }

  getIconoTipo(tipo: string): string {
    return ({
      PDF:    'ph-file-pdf',
      VIDEO:  'ph-video',
      IMAGEN: 'ph-image',
      WORD:   'ph-file-doc',
      EXCEL:  'ph-file-xls',
      PPT:    'ph-file-ppt'
    } as Record<string, string>)[tipo] || 'ph-file';
  }

  getCoverTipo(tipo: string): string {
    return ({
      PDF:    'cv-pdf',
      VIDEO:  'cv-video',
      IMAGEN: 'cv-imagen',
      WORD:   'cv-doc',
      EXCEL:  'cv-excel',
      PPT:    'cv-ppt'
    } as Record<string, string>)[tipo] || 'cv-otro';
  }

  getPillTipo(tipo: string): string {
    return ({
      PDF:    'tp-pdf',
      VIDEO:  'tp-video',
      IMAGEN: 'tp-imagen',
      WORD:   'tp-doc',
      EXCEL:  'tp-excel',
      PPT:    'tp-ppt'
    } as Record<string, string>)[tipo] || 'tp-otro';
  }

  getCiTipo(tipo: string): string {
    return ({
      PDF:    'ci-pdf',
      VIDEO:  'ci-video',
      IMAGEN: 'ci-imagen',
      WORD:   'ci-doc',
      EXCEL:  'ci-excel',
      PPT:    'ci-ppt'
    } as Record<string, string>)[tipo] || 'ci-otro';
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}