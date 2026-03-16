import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogService, Libro } from '../../../api/services/catalog.service';
import { PrestamoService } from '../../../api/services/prestamo.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CatalogoComponent implements OnInit {

  libros: Libro[] = [];
  search: string = '';
  filtroMateria: string = '';
  filtroFormato: string = '';
  ordenAutor: string = '';
  materias: { nombre: string }[] = [];
  pdfSeleccionado: string | null = null;

  // 📦 Modal préstamo
  modalPrestamo = false;
  libroSeleccionado: Libro | null = null;
  prestamoCargando = false;
  prestamoExitoso = false;
  prestamoError = '';

  constructor(
    private catalogService: CatalogService,
    private router: Router,
    private prestamoService: PrestamoService
  ) {}

  ngOnInit(): void {
    this.cargarMaterias();
    this.cargarCatalogo();
  }

  cargarCatalogo(): void {
    this.catalogService.obtenerCatalogo(
      this.search,
      this.filtroMateria,
      this.filtroFormato,
      this.ordenAutor
    ).subscribe({
      next: (res) => {
        this.paginaActual = 1;
        this.libros = res;
        this.libros.forEach(libro => {
          if (libro.tiene_digital && libro.id) {
            this.catalogService.obtenerPreview(libro.id).subscribe({
              next: (preview) => { libro.previewUrl = preview.previewUrl; },
              error: () => {}
            });
          }
        });
      },
      error: (err) => console.error('Error al cargar catálogo:', err)
    });
  }

  cargarMaterias(): void {
    this.catalogService.obtenerMaterias().subscribe({
      next: (res) => { this.materias = res; },
      error: (err) => console.error('Error al cargar materias:', err)
    });
  }

   abrirPdf(libro: Libro) {
  if (!libro.id) return;
   this.router.navigate(['/biblioteca/libro', libro.id]);
  }

  cerrarPdf(): void {
    this.pdfSeleccionado = null;
  }
  // PAGINACIÓN
  paginaActual = 1;
  librosPorPagina = 12;

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

  get librosFiltrados(): Libro[] {
    return this.libros; // ya vienen filtrados del backend
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  // ─── Modal préstamo ───────────────────────────────────

  abrirModalPrestamo(libro: Libro): void {
    this.libroSeleccionado = libro;
    this.modalPrestamo = true;
    this.prestamoExitoso = false;
    this.prestamoError = '';
  }

  cerrarModalPrestamo(): void {
    if (this.prestamoCargando) return; // evitar cerrar durante petición
    this.modalPrestamo = false;
    this.libroSeleccionado = null;
    this.prestamoExitoso = false;
    this.prestamoError = '';
  }

  confirmarPrestamo(): void {
    if (!this.libroSeleccionado?.id || this.prestamoCargando) return;

    this.prestamoCargando = true;
    this.prestamoError = '';

    this.prestamoService.solicitarPrestamo(this.libroSeleccionado.id).subscribe({
      next: () => {
        this.prestamoCargando = false;
        this.prestamoExitoso = true;
        // Actualizar stock en la vista sin recargar todo
        if (this.libroSeleccionado) {
          this.libroSeleccionado.disponibles =
            (this.libroSeleccionado.disponibles ?? 1) - 1;
        }
      },
      error: (err) => {
        this.prestamoCargando = false;
        this.prestamoError =
          err.error?.message || 'Error al solicitar el préstamo';
      }
    });
  }

get fechaVencimiento(): string {
  const fecha = new Date();
  return fecha.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) + ' antes de las 16:00 hrs';
}
}
