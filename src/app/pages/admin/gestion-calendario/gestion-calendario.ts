import { Component, CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../api/environments/environment';
import { AdminCalendarService } from '../../../api/services/admin-calendar.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestion-calendario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './gestion-calendario.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
   styleUrls: ['./gestion-calendario.css'],
})
export class GestionCalendarioComponent {

  calendars: any[] = [];
  mostrarModal = false;
  modoEdicion = false;
   // Estados de carga
  cargando  = false;   // tabla
  guardando = false;   // modal (crear / actualizar)

  titulo = '';
  tipo_calendario: 'ALUMNO' | 'DOCENTE' = 'ALUMNO';
  tipo_archivo: 'PDF' | 'IMAGEN' = 'PDF';

  archivo: File | null = null;
  archivoNombre = '';

  idEdicion: number | null = null;

  titulo_seccion = '';
  constructor(
    private http: HttpClient,
    private calendarService: AdminCalendarService
  ) {}

  ngOnInit() {
    this.loadCalendars();
  }

  // ==============================
  // 📥 Cargar calendarios
  // ==============================
  loadCalendars() {
    console.log('loadCalendars llamado');
    this.calendarService.getAll().subscribe(data => {
      this.calendars = data;
    });
  }

  // ==============================
  // 📂 Seleccionar archivo
  // ==============================
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.archivo = file;
    this.archivoNombre = file.name;

    if (file.type === 'application/pdf') {
      this.tipo_archivo = 'PDF';
    } else {
      this.tipo_archivo = 'IMAGEN';
    }
  }

  // ==============================
  // 💾 Guardar calendario
  // ==============================
  async guardar() {

  if (!this.titulo.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Campo obligatorio',
      text: 'El título del calendario es obligatorio.',
      confirmButtonColor: '#1976d2'
    });
    return;
  }

  if (!this.archivo && !this.modoEdicion) {
    Swal.fire({
      icon: 'warning',
      title: 'Archivo requerido',
      text: 'Debe seleccionar un archivo.',
      confirmButtonColor: '#1976d2'
    });
    return;
  }

  let archivo_url = '';

  // 🔹 Subir archivo
  if (this.archivo) {

    const formData = new FormData();
    formData.append('file', this.archivo);
    formData.append('tipo_calendario', this.tipo_calendario.toUpperCase());

    try {

      const uploadResponse: any = await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/calendarios/admin/upload`,
          formData
        )
      );

      archivo_url = uploadResponse.secure_url;

      if (!archivo_url) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se recibió la URL del archivo.',
          confirmButtonColor: '#d32f2f'
        });
        return;
      }

    } catch (error) {

      console.error('Error subiendo archivo:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Error al subir archivo',
        text: 'Ocurrió un problema al subir el archivo. Intente nuevamente.',
        confirmButtonColor: '#d32f2f'
      });

      return;
    }
  }

  const data = {
    titulo: this.titulo,
    titulo_seccion: this.titulo_seccion?.trim( )|| null,
    archivo_url,
    tipo_calendario: this.tipo_calendario.toUpperCase(),
    tipo_archivo: this.tipo_archivo
  };

  if (this.modoEdicion && this.idEdicion) {

    this.calendarService.update(this.idEdicion, data)
      .subscribe({
        next: async () => {

          await Swal.fire({
            icon: 'success',
            title: 'Actualizado correctamente',
            showConfirmButton: false,
            timer: 1500
          });

          this.resetForm();
          this.loadCalendars();
        },
        error: async () => {

          await Swal.fire({
            icon: 'error',
            title: 'Error al actualizar',
            text: 'No se pudo actualizar el calendario.',
            confirmButtonColor: '#d32f2f'
          });

        }
      });

  } else {

    this.calendarService.create(data)
      .subscribe({
        next: async () => {

          await Swal.fire({
            icon: 'success',
            title: 'Calendario creado',
            showConfirmButton: false,
            timer: 1500
          });

          this.resetForm();
          this.loadCalendars();
        },
        error: async () => {

          await Swal.fire({
            icon: 'error',
            title: 'Error al crear',
            text: 'No se pudo crear el calendario.',
            confirmButtonColor: '#d32f2f'
          });

        }
      });

  }
}
  // ==============================
  // ✏️ Editar
  // ==============================
  editar(calendar: any) {
    this.modoEdicion = true;
    this.mostrarModal = true;

    this.idEdicion = calendar.id;
    this.titulo = calendar.titulo;
    this.titulo_seccion = calendar.titulo_seccion || '';
    this.tipo_calendario = calendar.tipo_calendario;
    this.tipo_archivo = calendar.tipo_archivo;

    this.archivo = null;
    this.archivoNombre = '';
  }

  // ==============================
  // 🔄 Activar / Desactivar
  // ==============================
  toggleStatus(calendar: any) {
    const nuevoEstado = calendar.activo ? 0 : 1;

    this.calendarService.toggleStatus(calendar.id, nuevoEstado)
      .subscribe(() => {
        this.loadCalendars();
      });
  }

  // ==============================
  // 🗑 Eliminar
  // ==============================
  async delete(calendar: any) {

  const result = await Swal.fire({
    title: '¿Eliminar calendario?',
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d32f2f',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  this.calendarService.delete(calendar.id)
    .subscribe({
      next: async () => {

        await Swal.fire({
          icon: 'success',
          title: 'Eliminado correctamente',
          showConfirmButton: false,
          timer: 1500
        });

        this.loadCalendars();
      },
      error: async () => {

          await Swal.fire({
            icon: 'error',
            title: 'Error al eliminar',
            text: 'No se pudo eliminar el calendario.',
            confirmButtonColor: '#d32f2f'
          });

        }
      });
  }

  // ==============================
  // 🪟 Modal
  // ==============================
  abrirModal() {
    this.resetForm();
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.resetForm();
  }

  resetForm() {
    this.mostrarModal = false;
    this.modoEdicion = false;
    this.idEdicion = null;
    this.titulo = '';
    this.tipo_calendario = 'ALUMNO';
    this.tipo_archivo = 'PDF';
    this.archivo = null;
    this.titulo_seccion = '';
    this.archivoNombre = '';
  }
}