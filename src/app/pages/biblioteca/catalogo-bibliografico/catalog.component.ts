import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { CatalogService, Libro } from '../../../api/services/catalog.service';
import { PrestamoService } from '../../../api/services/prestamo.service';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';
import { Router } from '@angular/router';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None 
})
export class CatalogoComponent implements OnInit, OnDestroy {

  libros:       Libro[] = [];
  search        = '';
  filtroMateria = '';
  filtroFormato = '';
  ordenAutor    = '';
  materias:     { nombre: string }[] = [];
  pdfSeleccionado: string | null = null;
  cargando        = false; // overlay de carga por búsqueda/
  cargandoInicial = true;  // solo para la primera carga

  modalPrestamo     = false;
  libroSeleccionado: Libro | null = null;
  prestamoCargando  = false;
  prestamoExitoso   = false;
  prestamoError     = '';

  paginaActual    = 1;
  librosPorPagina = 12;

  private searchSubject = new Subject<string>();
  private destroy$      = new Subject<void>();

  constructor(
    private catalogService: CatalogService,
    private router: Router,
    private prestamoService: PrestamoService
  ) {}

  ngOnInit(): void {
    this.cargarMaterias();
    this._ejecutarCarga();

    // Fix: pasar el valor directamente al Subject para que debounce funcione
    this.searchSubject.pipe(
      debounceTime(400),
      takeUntil(this.destroy$)
    ).subscribe((valor) => {
      this.search = valor;
      this._ejecutarCarga();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Llamado por (input) del buscador — dispara debounce */
  onSearchInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.searchSubject.next(valor);
  }

  limpiarBusqueda(): void {
    this.search = '';
    this._ejecutarCarga();
  }

  cargarCatalogo(): void {
    this._ejecutarCarga();
  }

  /** Borrar solo los filtros de selects (NO el buscador) */
  borrarFiltros(): void {
    this.filtroMateria = '';
    this.filtroFormato = '';
    this.ordenAutor    = '';
    this._ejecutarCarga();
  }

  get hayFiltrosActivos(): boolean {
    return this.filtroMateria !== '' || this.filtroFormato !== '' || this.ordenAutor !== '';
  }

  private _ejecutarCarga(): void {
    if (this.cargandoInicial) {
      this.cargando = true;
    }
    this.paginaActual = 1;

    this.catalogService.obtenerCatalogo(
      this.search,
      this.filtroMateria,
      this.filtroFormato,
      this.ordenAutor
    ).subscribe({
      next: (res) => {
        this.libros          = res;
        this.cargando        = false;
        this.cargandoInicial = false; 
        this._cargarPreviewsPagina();
      },
      error: (err) => {
        console.error(err);
        this.cargando        = false;
        this.cargandoInicial = false;
      }
    });
  }

  private _cargarPreviewsPagina(): void {
    this.librosPaginados
      .filter(l => l.tiene_digital && l.id && !l.previewUrl)
      .forEach(libro => {
        this.catalogService.obtenerPreview(libro.id!).subscribe({
          next: (p) => { libro.previewUrl = p.previewUrl; },
          error: () => {}
        });
      });
  }

  cargarMaterias(): void {
    this.catalogService.obtenerMaterias().subscribe({
      next:  (res) => { this.materias = res; },
      error: (err) => console.error(err)
    });
  }

  abrirPdf(libro: Libro): void {
    if (!libro.id) return;
    this.router.navigate(['/biblioteca/libro', libro.id]);
  }
  cerrarPdf(): void { this.pdfSeleccionado = null; }

  get librosFiltrados(): Libro[] { return this.libros; }

  get librosPaginados(): Libro[] {
    const inicio = (this.paginaActual - 1) * this.librosPorPagina;
    return this.librosFiltrados.slice(inicio, inicio + this.librosPorPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.librosFiltrados.length / this.librosPorPagina);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this._cargarPreviewsPagina();
  }

  abrirModalPrestamo(libro: Libro): void {
    this.libroSeleccionado = libro;
    this.modalPrestamo     = true;
    this.prestamoExitoso   = false;
    this.prestamoError     = '';
  }

  cerrarModalPrestamo(): void {
    if (this.prestamoCargando) return;
    this.modalPrestamo     = false;
    this.libroSeleccionado = null;
    this.prestamoExitoso   = false;
    this.prestamoError     = '';
  }

  confirmarPrestamo(): void {
    if (!this.libroSeleccionado?.id || this.prestamoCargando) return;
    this.prestamoCargando = true;
    this.prestamoError    = '';

    this.prestamoService.solicitarPrestamo(this.libroSeleccionado.id).subscribe({
      next: () => {
        this.prestamoCargando = false;
        this.prestamoExitoso  = true;
        if (this.libroSeleccionado)
          this.libroSeleccionado.disponibles = (this.libroSeleccionado.disponibles ?? 1) - 1;
      },
      error: (err) => {
        this.prestamoCargando = false;
        this.prestamoError    = err.error?.message || 'Error al solicitar el préstamo';
      }
    });
  }

  get fechaVencimiento(): string {
    return new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }) + ' antes de las 16:00 hrs';
  }
}
