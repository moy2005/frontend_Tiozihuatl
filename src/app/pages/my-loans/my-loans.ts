import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrestamoService, Prestamo } from '../../api/services/prestamo.service';
import { CatalogService } from '../../api/services/catalog.service';

@Component({
  selector: 'app-my-loans',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-loans.html',
  styleUrls: ['./my-loans.css'],
  encapsulation: ViewEncapsulation.None
})
export class MyLoans implements OnInit {
  misPrestamos: Prestamo[] = [];
  prestamosFiltrados: Prestamo[] = [];
  cargando: boolean = false;
  mensajeError: string = '';

  filtroActual: string = 'Todos';
  filtrosDisponibles: string[] = ['Todos', 'Activos', 'Próximos', 'Devueltos'];

  constructor(
    private prestamoService: PrestamoService,
    private catalogService: CatalogService
  ) {}

  ngOnInit(): void {
    this.cargarMisPrestamos();
  }

  cargarMisPrestamos(): void {
    this.cargando = true;
    this.mensajeError = '';

    this.prestamoService.obtenerMisPrestamos().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.misPrestamos = response.data;

          // Cargar preview solo para los que tienen formato digital
          this.misPrestamos.forEach(prestamo => {
            if (prestamo.pdf_url && prestamo.libro_id) {
              this.catalogService.obtenerPreview(prestamo.libro_id).subscribe({
                next: (preview) => { prestamo.previewUrl = preview.previewUrl; },
                error: () => {}
              });
            }
          });

          this.aplicarFiltro(this.filtroActual);
        } else {
          this.mensajeError = response.message || 'Ocurrió un error al cargar los préstamos.';
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar préstamos:', error);
        this.mensajeError = 'No se pudo conectar con el servidor.';
        this.cargando = false;
      }
    });
  }

  cambiarFiltro(filtro: string): void {
    this.filtroActual = filtro;
    this.aplicarFiltro(filtro);
  }

  aplicarFiltro(filtro: string): void {
    if (filtro === 'Todos') {
      this.prestamosFiltrados = [...this.misPrestamos];
    } else if (filtro === 'Activos') {
      this.prestamosFiltrados = this.misPrestamos.filter(p => p.estado.toLowerCase() === 'activo');
    } else if (filtro === 'Devueltos') {
      this.prestamosFiltrados = this.misPrestamos.filter(p => p.estado.toLowerCase() === 'devuelto');
    } else if (filtro === 'Próximos') {
      this.prestamosFiltrados = this.misPrestamos.filter(p => p.estado.toLowerCase() === 'activo');
    }
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: '2-digit'
    }).replace('.', '');
  }
}