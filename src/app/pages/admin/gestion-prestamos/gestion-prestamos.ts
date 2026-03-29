import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { PrestamoAdminService, PrestamoAdmin } from '../../../api/services/prestamo-admin.service';

@Component({
  selector: 'app-gestion-prestamos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './gestion-prestamos.html',
  styleUrls: ['./gestion-prestamos.css'],
  encapsulation: ViewEncapsulation.None
})
export class GestionPrestamosComponent implements OnInit {

  prestamos: PrestamoAdmin[] = [];
  prestamosVisibles: PrestamoAdmin[] = [];
  cargando = false;

  // Filtros
  filtroEstado = '';
  filtroBusqueda = '';
  filtroOrden: 'ASC' | 'DESC' = 'DESC';

  // Modal observaciones
  modalObservaciones = false;
  prestamoEditando: PrestamoAdmin | null = null;
  observacionesTexto = '';
  guardandoObs = false;

  constructor(private prestamoService: PrestamoAdminService) {}

  ngOnInit(): void {
    this.cargarPrestamos();
  }

  cargarPrestamos(): void {
    this.cargando = true;
    this.prestamoService.listar().subscribe({
      next: (res) => {
        this.prestamos = res.data;
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los préstamos', 'error');
        this.cargando = false;
      }
    });
  }

  aplicarFiltros(): void {
    let resultado = [...this.prestamos];

    // Filtro estado
    if (this.filtroEstado) {
      resultado = resultado.filter(p => p.estado === this.filtroEstado);
    }

    // Búsqueda por estudiante o libro
    if (this.filtroBusqueda.trim()) {
      const busq = this.filtroBusqueda.toLowerCase();
      resultado = resultado.filter(p =>
        p.nombre?.toLowerCase().includes(busq) ||
        p.titulo?.toLowerCase().includes(busq)
      );
    }

    // Orden por fecha
    resultado.sort((a, b) => {
      const fa = new Date(a.fecha_prestamo).getTime();
      const fb = new Date(b.fecha_prestamo).getTime();
      return this.filtroOrden === 'DESC' ? fb - fa : fa - fb;
    });

    this.prestamosVisibles = resultado;
  }

  // ── Acciones ─────────────────────────────────

  devolver(prestamo: PrestamoAdmin): void {
    Swal.fire({
      title: '¿Confirmar devolución?',
      html: `<b>${prestamo.nombre}</b> devuelve <b>${prestamo.titulo}</b>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, devolver',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.prestamoService.devolver(prestamo.id_prestamo).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Devuelto', timer: 1500, showConfirmButton: false });
          this.cargarPrestamos();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al devolver', 'error')
      });
    });
  }

  cancelar(prestamo: PrestamoAdmin): void {
    Swal.fire({
      title: '¿Cancelar préstamo?',
      html: `Se cancelará el préstamo de <b>${prestamo.titulo}</b> de <b>${prestamo.nombre}</b>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.prestamoService.cancelar(prestamo.id_prestamo).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Cancelado', timer: 1500, showConfirmButton: false });
          this.cargarPrestamos();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al cancelar', 'error')
      });
    });
  }

  marcarVencido(prestamo: PrestamoAdmin): void {
    Swal.fire({
      title: '¿Marcar como vencido?',
      html: `El préstamo de <b>${prestamo.titulo}</b> se marcará como vencido`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, marcar',
      cancelButtonText: 'No'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.prestamoService.marcarVencido(prestamo.id_prestamo).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Marcado como vencido', timer: 1500, showConfirmButton: false });
          this.cargarPrestamos();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al marcar vencido', 'error')
      });
    });
  }

  // ── Modal observaciones ──────────────────────

  abrirObservaciones(prestamo: PrestamoAdmin): void {
    this.prestamoEditando = prestamo;
    this.observacionesTexto = prestamo.observaciones || '';
    this.modalObservaciones = true;
  }

  cerrarObservaciones(): void {
    this.modalObservaciones = false;
    this.prestamoEditando = null;
    this.observacionesTexto = '';
  }

  guardarObservaciones(): void {
    if (!this.prestamoEditando || !this.observacionesTexto.trim()) return;

    this.guardandoObs = true;
    this.prestamoService
      .actualizarObservaciones(this.prestamoEditando.id_prestamo, this.observacionesTexto)
      .subscribe({
        next: () => {
          this.guardandoObs = false;
          Swal.fire({ icon: 'success', title: 'Observaciones guardadas', timer: 1500, showConfirmButton: false });
          this.cerrarObservaciones();
          this.cargarPrestamos();
        },
        error: (err) => {
          this.guardandoObs = false;
          Swal.fire('Error', err.error?.message || 'Error al guardar', 'error');
        }
      });
  }

  // ── Helpers ──────────────────────────────────

  getBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      'Activo':    'badge-activo',
      'Devuelto':  'badge-devuelto',
      'Vencido':   'badge-vencido',
      'Cancelado': 'badge-cancelado'
    };
    return map[estado] ?? '';
  }

  esAccionable(estado: string): boolean {
    return estado === 'Activo';
  }
}
