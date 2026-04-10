import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MateriasService, CanDeleteResponse } from '../../../api/services/materias.service';
import Swal from 'sweetalert2';

interface DeleteInfo {
  verificando:    boolean;
  puedeEliminar:  boolean;
  relaciones:     CanDeleteResponse['relaciones'];
}

@Component({
  selector:    'app-gestion-materias',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './gestion-materias.component.html',
  styleUrls:   ['./gestion-materias.component.css'],
  schemas:     [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionMateriasComponent implements OnInit {

  materias:  any[]  = [];
  loading            = false;
  guardando          = false;
  search             = '';

  form: any                          = { nombre: '' };
  editando                           = false;
  materiaSeleccionada: any           = null;
  showModal                          = false;

  // Caché de verificación: { [materia.id]: DeleteInfo }
  deleteInfo: Record<number, DeleteInfo> = {};

  constructor(private materiasService: MateriasService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading    = true;
    this.deleteInfo = {};
    const params: any = {};
    if (this.search) params.search = this.search;

    this.materiasService.getAll(params).subscribe({
      next: (res) => {
        this.materias = res;
        this.loading  = false;
        this.verificarTodas();
      },
      error: () => {
        this.loading = false;
        Swal.fire({
          icon: 'error', title: 'Error al cargar',
          text: 'No se pudieron obtener las materias. Intenta de nuevo.',
          confirmButtonColor: '#29B6F6'
        });
      }
    });
  }

  buscar()  { this.load(); }
  limpiar() { this.search = ''; this.load(); }

  private verificarTodas() {
    this.materias.forEach(m => this.verificarUna(m.id));
  }

  private verificarUna(id: number) {
    this.deleteInfo[id] = { verificando: true, puedeEliminar: false, relaciones: [] };

    this.materiasService.canDelete(id).subscribe({
      next: (res) => {
        this.deleteInfo[id] = {
          verificando:   false,
          puedeEliminar: res.puedeEliminar,
          relaciones:    res.relaciones
        };
      },
      error: () => {
        // Si falla la verificación, bloqueamos por seguridad 
        this.deleteInfo[id] = { verificando: false, puedeEliminar: false, relaciones: [] };
      }
    });
  }

  abrirModal() {
    this.resetForm();
    this.editando  = false;
    this.showModal = true;
  }

  cerrarModal() {
    if (this.guardando) return;
    this.showModal = false;
  }

  editar(materia: any) {
    this.form                = { ...materia };
    this.materiaSeleccionada = materia;
    this.editando            = true;
    this.showModal           = true;
  }

  guardar() {
    if (!this.form.nombre?.trim()) {
      Swal.fire({
        icon: 'warning', title: 'Campo requerido',
        text: 'El nombre de la materia es obligatorio.',
        confirmButtonColor: '#29B6F6'
      });
      return;
    }

    this.guardando = true;

    const request$ = this.editando
      ? this.materiasService.update(this.materiaSeleccionada.id, this.form)
      : this.materiasService.create(this.form);

    request$.subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModal();
        this.load();
        Swal.fire({
          icon:  'success',
          title: this.editando ? 'Materia actualizada' : 'Materia creada',
          text:  this.editando
            ? 'Los cambios se guardaron correctamente.'
            : 'La materia fue registrada exitosamente.',
          confirmButtonColor: '#29B6F6',
          timer: 2500, timerProgressBar: true, showConfirmButton: false
        });
      },
      error: () => {
        this.guardando = false;
        Swal.fire({
          icon: 'error', title: 'Error al guardar',
          text: 'Ocurrió un problema al guardar la materia. Intenta de nuevo.',
          confirmButtonColor: '#29B6F6'
        });
      }
    });
  }

  cambiarEstado(materia: any) {
    const nuevoEstado  = materia.activo === 1 ? 0 : 1;
    const accion       = nuevoEstado === 1 ? 'activar'   : 'desactivar';
    const accionPasado = nuevoEstado === 1 ? 'activada'  : 'desactivada';

    Swal.fire({
      icon: 'question',
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} materia?`,
      text:  `¿Estás seguro de que deseas ${accion} "${materia.nombre}"?`,
      showCancelButton:    true,
      confirmButtonText:   `Sí, ${accion}`,
      cancelButtonText:    'Cancelar',
      confirmButtonColor:  nuevoEstado === 1 ? '#4CAF50' : '#F44336',
      cancelButtonColor:   '#64748B'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.materiasService.toggle(materia.id, nuevoEstado).subscribe({
        next: () => {
          this.load();
          Swal.fire({
            icon: 'success', title: `Materia ${accionPasado}`,
            text: `"${materia.nombre}" fue ${accionPasado} correctamente.`,
            confirmButtonColor: '#29B6F6',
            timer: 2000, timerProgressBar: true, showConfirmButton: false
          });
        },
        error: () => {
          Swal.fire({
            icon: 'error', title: 'Error',
            text: `No se pudo ${accion} la materia. Intenta de nuevo.`,
            confirmButtonColor: '#29B6F6'
          });
        }
      });
    });
  }

  eliminar(materia: any) {
    const info = this.deleteInfo[materia.id];

    if (!info?.puedeEliminar) {
      this.mostrarRelaciones(materia);
      return;
    }

    Swal.fire({
      icon:  'warning',
      title: '¿Eliminar materia?',
      html:  `<p style="color:#64748B">
                Se eliminará permanentemente <strong>"${materia.nombre}"</strong>.
              </p>`,
      showCancelButton:   true,
      confirmButtonText:  'Sí, eliminar',
      cancelButtonText:   'Cancelar',
      confirmButtonColor: '#EF4444',
      cancelButtonColor:  '#64748B',
      focusCancel:        true   
    }).then(result => {
      if (!result.isConfirmed) return;

      this.materiasService.delete(materia.id).subscribe({
        next: () => {
          this.load();
          Swal.fire({
            icon: 'success', title: 'Materia eliminada',
            text: `"${materia.nombre}" fue eliminada permanentemente.`,
            confirmButtonColor: '#29B6F6',
            timer: 2000, timerProgressBar: true, showConfirmButton: false
          });
        },
        error: (err) => {
          // 409 = el backend detectó relaciones en la segunda verificación
          const msg = err?.error?.message ?? 'No se pudo eliminar la materia. Intenta de nuevo.';
          Swal.fire({
            icon: 'error', title: 'Error al eliminar',
            text: msg, confirmButtonColor: '#29B6F6'
          });
          // Re-verificar para actualizar el ícono
          this.verificarUna(materia.id);
        }
      });
    });
  }

  mostrarRelaciones(materia: any) {
    const info = this.deleteInfo[materia.id];
    if (!info || info.verificando) return;

    const lista = info.relaciones.length
      ? info.relaciones
          .map(r => `<li><strong>${r.tabla}</strong> (${r.columna}): ${r.total} registro${r.total === 1 ? '' : 's'}</li>`)
          .join('')
      : '<li>Sin detalles disponibles</li>';

    Swal.fire({
      icon:  'warning',
      title: 'No se puede eliminar',
      html:  `<p style="color:#64748B;margin-bottom:.75rem">
                <strong>"${materia.nombre}"</strong> tiene registros relacionados:
              </p>
              <p style="color:#64748B;font-size:.8125rem;margin-top:.75rem">
                Puedes <strong>desactivarla</strong> en lugar de eliminarla.
              </p>`,
      confirmButtonText:  'Entendido',
      confirmButtonColor: '#29B6F6'
    });
  }

  private resetForm() {
    this.form                = { nombre: '' };
    this.materiaSeleccionada = null;
  }
}