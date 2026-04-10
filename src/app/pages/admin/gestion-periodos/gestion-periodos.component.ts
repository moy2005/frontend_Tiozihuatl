import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeriodosService, CanDeleteResponse } from '../../../api/services/periodos.service';
import Swal from 'sweetalert2';

interface DeleteInfo {
  verificando:   boolean;
  puedeEliminar: boolean;
  relaciones:    CanDeleteResponse['relaciones'];
}
@Component({
  selector:    'app-gestion-periodos',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './gestion-periodos.component.html',
  styleUrls:   ['./gestion-periodos.component.css'],
  schemas:     [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionPeriodosComponent implements OnInit {

  periodos:  any[] = [];
  loading           = false;
  guardando         = false;
  search            = '';

  form: any = { nombre: '', fecha_inicio: '', fecha_fin: '' };

  editando             = false;
  periodoSeleccionado: any = null;
  showModal            = false;

  // Caché de verificación: { [periodo.id_periodo]: DeleteInfo }
  deleteInfo: Record<number, DeleteInfo> = {};

  constructor(private periodosService: PeriodosService) {}

  ngOnInit(): void { this.load(); }

  load() {
    this.loading    = true;
    this.deleteInfo = {};
    const params: any = {};
    if (this.search) params.search = this.search;

    this.periodosService.getAll(params).subscribe({
      next: (res) => {
        this.periodos = res;
        this.loading  = false;
        this.verificarTodos();
      },
      error: () => {
        this.loading = false;
        Swal.fire({
          icon: 'error', title: 'Error al cargar',
          text: 'No se pudieron obtener los periodos. Intenta de nuevo.',
          confirmButtonColor: '#29B6F6'
        });
      }
    });
  }

  buscar()  { this.load(); }
  limpiar() { this.search = ''; this.load(); }

  private verificarTodos() {
    this.periodos.forEach(p => this.verificarUno(p.id_periodo));
  }

  private verificarUno(id: number) {
    this.deleteInfo[id] = { verificando: true, puedeEliminar: false, relaciones: [] };

    this.periodosService.canDelete(id).subscribe({
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

  editar(periodo: any) {
    this.form = {
      nombre:       periodo.nombre,
      fecha_inicio: this.formatDate(periodo.fecha_inicio),
      fecha_fin:    this.formatDate(periodo.fecha_fin)
    };
    this.periodoSeleccionado = periodo;
    this.editando            = true;
    this.showModal           = true;
  }

  guardar() {
    if (!this.form.nombre?.trim() || !this.form.fecha_inicio || !this.form.fecha_fin) {
      Swal.fire({
        icon: 'warning', title: 'Campos requeridos',
        text: 'El nombre, la fecha de inicio y la fecha de fin son obligatorios.',
        confirmButtonColor: '#29B6F6'
      });
      return;
    }

    if (this.form.fecha_inicio > this.form.fecha_fin) {
      Swal.fire({
        icon: 'warning', title: 'Fechas inválidas',
        text: 'La fecha de inicio no puede ser mayor a la fecha de fin.',
        confirmButtonColor: '#29B6F6'
      });
      return;
    }

    this.guardando = true;

    const request$ = this.editando
      ? this.periodosService.update(this.periodoSeleccionado.id_periodo, this.form)
      : this.periodosService.create(this.form);

    request$.subscribe({
      next: () => {
        this.guardando = false;
        this.showModal = false;
        this.load();
        Swal.fire({
          icon:  'success',
          title: this.editando ? 'Periodo actualizado' : 'Periodo creado',
          text:  this.editando
            ? 'Los cambios se guardaron correctamente.'
            : 'El periodo fue registrado exitosamente.',
          confirmButtonColor: '#29B6F6',
          timer: 2500, timerProgressBar: true, showConfirmButton: false
        });
      },
      error: (err: any) => {
        this.guardando = false;
        this.manejarErrorGuardar(err);
      }
    });
  }

  private manejarErrorGuardar(err: any) {
  const msg: string  = err?.error?.message || '';
  const esTraslape   = msg.toLowerCase().includes('traslapa');
  const esBadRequest = err?.status === 400;

  if (esTraslape) {
    Swal.fire({
      html: `
        <div style="text-align:center;margin-bottom:1rem">
          <ion-icon name="warning-outline"
            style="font-size:3rem;color:#F59E0B"></ion-icon>
          <h3 style="margin:.5rem 0 0;color:#1E293B;font-size:1.1rem;font-weight:700">
            Conflicto de fechas
          </h3>
        </div>
        <p style="color:#64748B;font-size:.875rem;text-align:center;margin-bottom:.875rem">
          Las fechas ingresadas se cruzan con un periodo ya registrado.
        </p>
        <div style="background:#F1F9FE;border:1px solid #BAE6FD;border-radius:8px;
                    padding:.75rem 1rem;font-size:.8125rem;color:#0369A1;
                    display:flex;align-items:flex-start;gap:.5rem;text-align:left">
          <ion-icon name="calendar-outline"
            style="font-size:1rem;margin-top:.1rem;flex-shrink:0"></ion-icon>
          <div>
            <strong>Rango ingresado:</strong><br>
            ${this.form.fecha_inicio} &nbsp;→&nbsp; ${this.form.fecha_fin}
          </div>
        </div>
        <p style="color:#94A3B8;font-size:.8rem;text-align:center;margin-top:.75rem">
          Ajusta las fechas para que no coincidan con otro periodo existente.
        </p>`,
      confirmButtonText:  'Corregir fechas',
      confirmButtonColor: '#29B6F6',
      width: '440px'
    });

  } else if (esBadRequest) {
    Swal.fire({
      html: `
        <div style="text-align:center;margin-bottom:1rem">
          <ion-icon name="alert-circle-outline"
            style="font-size:2.5rem;color:#64748B"></ion-icon>
          <h3 style="margin:.5rem 0 0;color:#1E293B;font-size:1.1rem;font-weight:700">
            Datos inválidos
          </h3>
        </div>
        <p style="color:#64748B;font-size:.875rem;text-align:center">
          ${msg || 'Los datos enviados no son válidos. Revísalos e intenta de nuevo.'}
        </p>`,
      confirmButtonText:  'Entendido',
      confirmButtonColor: '#29B6F6'
    });

  } else {
    Swal.fire({
      html: `
        <div style="text-align:center;margin-bottom:1rem">
          <ion-icon name="close-circle-outline"
            style="font-size:2.5rem;color:#EF4444"></ion-icon>
          <h3 style="margin:.5rem 0 0;color:#1E293B;font-size:1.1rem;font-weight:700">
            Error inesperado
          </h3>
        </div>
        <p style="color:#64748B;font-size:.875rem;text-align:center">
          Ocurrió un problema en el servidor. Intenta de nuevo más tarde.
        </p>`,
      confirmButtonText:  'Cerrar',
      confirmButtonColor: '#29B6F6'
    });
  }
}

  activar(id: number) {
    const periodo = this.periodos.find(p => p.id_periodo === id);

    Swal.fire({
      icon: 'question', title: '¿Activar este periodo?',
      html: `<p>Se activará <strong>"${periodo?.nombre}"</strong>.</p>
             <p style="color:#64748B;font-size:.85rem;margin-top:.5rem">
               El periodo activo actual será cerrado automáticamente.
             </p>`,
      showCancelButton:   true,
      confirmButtonText:  'Sí, activar',
      cancelButtonText:   'Cancelar',
      confirmButtonColor: '#4CAF50',
      cancelButtonColor:  '#64748B'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.periodosService.activar(id).subscribe({
        next: () => {
          this.load();
          Swal.fire({
            icon: 'success', title: 'Periodo activado',
            text: `"${periodo?.nombre}" es ahora el periodo activo.`,
            confirmButtonColor: '#29B6F6',
            timer: 2000, timerProgressBar: true, showConfirmButton: false
          });
        },
        error: () => {
          Swal.fire({
            icon: 'error', title: 'Error al activar',
            text: 'No se pudo activar el periodo. Intenta de nuevo.',
            confirmButtonColor: '#29B6F6'
          });
        }
      });
    });
  }

  eliminar(id: number) {
    const periodo = this.periodos.find(p => p.id_periodo === id);
    const info    = this.deleteInfo[id];

    if (!info?.puedeEliminar) {
      this.mostrarRelaciones(periodo);
      return;
    }

    Swal.fire({
      icon:  'warning',
      title: '¿Eliminar periodo?',
      html:  `<p style="color:#64748B">
                Se eliminará permanentemente <strong>"${periodo?.nombre}"</strong>.
              </p>`,
      showCancelButton:   true,
      confirmButtonText:  'Sí, eliminar',
      cancelButtonText:   'Cancelar',
      confirmButtonColor: '#EF4444',
      cancelButtonColor:  '#64748B',
      focusCancel:        true
    }).then(result => {
      if (!result.isConfirmed) return;

      this.periodosService.delete(id).subscribe({
        next: () => {
          this.load();
          Swal.fire({
            icon: 'success', title: 'Periodo eliminado',
            text: `"${periodo?.nombre}" fue eliminado permanentemente.`,
            confirmButtonColor: '#29B6F6',
            timer: 2000, timerProgressBar: true, showConfirmButton: false
          });
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'No se pudo eliminar el periodo. Intenta de nuevo.';
          Swal.fire({
            icon: 'error', title: 'Error al eliminar',
            text: msg, confirmButtonColor: '#29B6F6'
          });
          this.verificarUno(id);
        }
      });
    });
  }

  mostrarRelaciones(periodo: any) {
    const info = this.deleteInfo[periodo?.id_periodo];
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
                <strong>"${periodo?.nombre}"</strong> tiene registros relacionados:
              </p>
              <ul style="text-align:left;background:#FEF9EC;border-radius:8px;
                         padding:.75rem 1rem .75rem 2rem;font-size:.875rem;color:#92400E;margin:0">
                ${lista}
              </ul>
              <p style="color:#64748B;font-size:.8125rem;margin-top:.75rem">
                No es posible eliminar un periodo con datos asociados.
              </p>`,
      confirmButtonText:  'Entendido',
      confirmButtonColor: '#29B6F6'
    });
  }

  resetForm() {
    this.form                = { nombre: '', fecha_inicio: '', fecha_fin: '' };
    this.periodoSeleccionado = null;
  }

  formatDate(date: string): string {
    if (!date) return '';
    return date.includes('T') ? date.split('T')[0] : date;
  }
}