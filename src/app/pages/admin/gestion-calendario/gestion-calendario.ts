import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CloudinaryService } from '../../../api/services/cloudinary.service';
import { environment } from '../../../api/environments/environment.prod';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-gestion-calendario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-calendario.html',
  styleUrls: ['./gestion-calendario.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionCalendarioComponent implements OnInit {

  private api = `${environment.apiUrl}/calendar/admin`;

  calendars: any[] = [];
  selectedFile!: File;
  titulo        = '';
  archivoNombre = '';

  modoEdicion        = false;
  calendarioEditando: any = null;

  mostrarModal = false;

  // Estados de carga
  cargando  = false;   // tabla
  guardando = false;   // modal (crear / actualizar)

  constructor(
    private http: HttpClient,
    private cloudinary: CloudinaryService
  ) {}

  ngOnInit(): void {
    this.loadCalendars();
  }

  // -------------------------------------------------------
  // MODAL
  // -------------------------------------------------------

  abrirModal(): void {
    this.resetFormulario();
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    if (this.guardando) return;
    this.mostrarModal = false;
    this.resetFormulario();
  }

  // -------------------------------------------------------
  // LISTAR
  // -------------------------------------------------------

  async loadCalendars(): Promise<void> {
    this.cargando = true;
    try {
      this.calendars = await firstValueFrom(
        this.http.get<any[]>(this.api)
      );
    } catch {
      Swal.fire('Error', 'No se pudieron cargar los calendarios.', 'error');
    } finally {
      this.cargando = false;
    }
  }

  // -------------------------------------------------------
  // ARCHIVO
  // -------------------------------------------------------

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) {
      this.selectedFile  = file;
      this.archivoNombre = file.name;
    }
  }

  // -------------------------------------------------------
  // GUARDAR (crear o actualizar)
  // -------------------------------------------------------

  async guardar(): Promise<void> {
    if (!this.titulo.trim()) {
      Swal.fire('Campo requerido', 'Debes ingresar un título.', 'warning');
      return;
    }

    if (!this.modoEdicion) {
      await this.crear();
    } else {
      await this.actualizar();
    }
  }

  // -------------------------------------------------------
  // CREAR
  // -------------------------------------------------------

  private async crear(): Promise<void> {
    if (!this.selectedFile) {
      Swal.fire('Archivo requerido', 'Debes seleccionar un archivo.', 'warning');
      return;
    }

    this.guardando = true;
    try {
      const isPdf       = this.selectedFile.type.includes('pdf');
      const uploadType  = isPdf ? 'raw' : 'image';

      const response = await firstValueFrom(
        this.cloudinary.uploadFile(this.selectedFile, uploadType)
      );

      await firstValueFrom(
        this.http.post(this.api, {
          titulo:      this.titulo,
          archivo_url: response.secure_url,
          tipo:        isPdf ? 'PDF' : 'IMAGEN'
        })
      );

      Swal.fire('Creado', 'El calendario fue creado correctamente.', 'success');
      await this.loadCalendars();
      this.cerrarModal();

    } catch {
      Swal.fire('Error', 'No se pudo crear el calendario.', 'error');
    } finally {
      this.guardando = false;
    }
  }

  // -------------------------------------------------------
  // EDITAR (abre modal en modo edición)
  // -------------------------------------------------------

  editar(calendar: any): void {
    this.modoEdicion        = true;
    this.calendarioEditando = calendar;
    this.titulo             = calendar.titulo;
    this.archivoNombre      = '';
    this.mostrarModal       = true;
  }

  // -------------------------------------------------------
  // ACTUALIZAR
  // -------------------------------------------------------

  private async actualizar(): Promise<void> {
    this.guardando = true;
    try {

      if (!this.selectedFile) {
        // Sin cambio de archivo
        await firstValueFrom(
          this.http.put(`${this.api}/${this.calendarioEditando.id}`, {
            titulo:      this.titulo,
            archivo_url: this.calendarioEditando.archivo_url,
            tipo:        this.calendarioEditando.tipo
          })
        );
      } else {
        // Con nuevo archivo
        const isPdf      = this.selectedFile.type.includes('pdf');
        const uploadType = isPdf ? 'raw' : 'image';

        const response = await firstValueFrom(
          this.cloudinary.uploadFile(this.selectedFile, uploadType)
        );

        await firstValueFrom(
          this.http.put(`${this.api}/${this.calendarioEditando.id}`, {
            titulo:      this.titulo,
            archivo_url: response.secure_url,
            tipo:        isPdf ? 'PDF' : 'IMAGEN'
          })
        );
      }

      Swal.fire('Actualizado', 'El calendario fue actualizado correctamente.', 'success');
      await this.loadCalendars();
      this.cerrarModal();

    } catch {
      Swal.fire('Error', 'No se pudo actualizar el calendario.', 'error');
    } finally {
      this.guardando = false;
    }
  }

  // -------------------------------------------------------
  // ACTIVAR / DESACTIVAR
  // -------------------------------------------------------

  async toggleStatus(calendar: any): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${this.api}/${calendar.id}/status`, {
          activo: calendar.activo ? 0 : 1
        })
      );
      await this.loadCalendars();
    } catch {
      Swal.fire('Error', 'No se pudo cambiar el estado.', 'error');
    }
  }

  // -------------------------------------------------------
  // ELIMINAR
  // -------------------------------------------------------

  async delete(calendar: any): Promise<void> {
    const result = await Swal.fire({
      title:              '¿Eliminar calendario?',
      text:               `Se eliminará "${calendar.titulo}" permanentemente.`,
      icon:               'warning',
      showCancelButton:   true,
      confirmButtonText:  'Sí, eliminar',
      cancelButtonText:   'Cancelar',
      confirmButtonColor: '#F44336'
    });

    if (!result.isConfirmed) return;

    try {
      await firstValueFrom(
        this.http.delete(`${this.api}/${calendar.id}`)
      );
      Swal.fire('Eliminado', 'El calendario fue eliminado.', 'success');
      await this.loadCalendars();
    } catch {
      Swal.fire('Error', 'No se pudo eliminar el calendario.', 'error');
    }
  }

  // -------------------------------------------------------
  // RESET
  // -------------------------------------------------------

  private resetFormulario(): void {
    this.titulo             = '';
    this.selectedFile       = undefined as any;
    this.modoEdicion        = false;
    this.calendarioEditando = null;
    this.archivoNombre      = '';
  }

}