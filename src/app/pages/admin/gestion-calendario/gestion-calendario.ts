import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CloudinaryService } from '../../../api/services/cloudinary.service';
import { environment } from '../../../api/environments/environment.prod'

@Component({
  selector: 'app-gestion-calendario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-calendario.html',
  styleUrls: ['./gestion-calendario.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionCalendarioComponent implements OnInit {

  //private api = 'http://localhost:4000/api/calendar/admin';

  private api = `${environment.apiUrl}/calendar/admin`;

  calendars: any[] = [];
  selectedFile!: File;
  titulo = '';
  cargando = false;
  mensaje = '';

  modoEdicion = false;
  calendarioEditando: any = null;

  // ✅ NUEVO: control del modal y nombre del archivo
  mostrarModal = false;
  archivoNombre = '';

  constructor(
    private http: HttpClient,
    private cloudinary: CloudinaryService
  ) {}

  ngOnInit() {
    this.loadCalendars();
  }

  // =============================
  // 📋 Abrir / Cerrar Modal
  // =============================
  abrirModal(): void {
    this.resetFormulario();
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.resetFormulario();
  }

  // =============================
  // 📥 Listar
  // =============================
  loadCalendars() {
    this.http.get<any[]>(this.api)
      .subscribe(data => this.calendars = data);
  }

  // =============================
  // 📎 Detectar archivo
  // =============================
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.archivoNombre = file.name; // ✅ muestra nombre en el upload-zone
    }
  }

  // =============================
  // ➕ Crear o Actualizar
  // =============================
  guardar() {
    if (!this.titulo.trim()) {
      this.mensaje = '⚠️ Debes ingresar título';
      return;
    }

    if (!this.modoEdicion) {
      this.crear();
    } else {
      this.actualizar();
    }
  }

  // =============================
  // ➕ CREAR
  // =============================
  crear() {
    if (!this.selectedFile) {
      this.mensaje = '⚠️ Debes seleccionar archivo';
      return;
    }

    const isPdf = this.selectedFile.type.includes('pdf');
    const uploadType = isPdf ? 'raw' : 'image';

    this.cloudinary.uploadFile(this.selectedFile, uploadType)
      .subscribe(response => {

        const tipo = isPdf ? 'PDF' : 'IMAGEN';

        this.http.post(this.api, {
          titulo: this.titulo,
          archivo_url: response.secure_url,
          tipo
        }).subscribe(() => {
          this.mensaje = '✅ Calendario creado';
          this.loadCalendars();
          this.cerrarModal(); // ✅ cierra modal al crear
        });
      });
  }

  // =============================
  // ✏ EDITAR (abrir modal en modo edición)
  // =============================
  editar(calendar: any) {
    this.modoEdicion = true;
    this.calendarioEditando = calendar;
    this.titulo = calendar.titulo;
    this.archivoNombre = ''; // sin archivo nuevo aún
    this.mostrarModal = true; // ✅ abre el modal
  }

  // =============================
  // 🔄 ACTUALIZAR
  // =============================
  actualizar() {

    // Sin cambio de archivo
    if (!this.selectedFile) {
      this.http.put(`${this.api}/${this.calendarioEditando.id}`, {
        titulo: this.titulo,
        archivo_url: this.calendarioEditando.archivo_url,
        tipo: this.calendarioEditando.tipo
      }).subscribe(() => {
        this.mensaje = '✅ Calendario actualizado';
        this.loadCalendars();
        this.cerrarModal(); // ✅ cierra modal al actualizar
      });
      return;
    }

    // Con cambio de archivo
    const isPdf = this.selectedFile.type.includes('pdf');
    const uploadType = isPdf ? 'raw' : 'image';

    this.cloudinary.uploadFile(this.selectedFile, uploadType)
      .subscribe(response => {

        const tipo = isPdf ? 'PDF' : 'IMAGEN';

        this.http.put(`${this.api}/${this.calendarioEditando.id}`, {
          titulo: this.titulo,
          archivo_url: response.secure_url,
          tipo
        }).subscribe(() => {
          this.mensaje = '✅ Calendario actualizado con nuevo archivo';
          this.loadCalendars();
          this.cerrarModal(); // ✅ cierra modal al actualizar con archivo
        });
      });
  }

  // =============================
  // 🔄 Activar / Desactivar
  // =============================
  toggleStatus(calendar: any) {
    this.http.put(`${this.api}/${calendar.id}/status`, {
      activo: calendar.activo ? 0 : 1
    }).subscribe(() => {
      this.loadCalendars();
    });
  }

  // =============================
  // 🗑 Eliminar
  // =============================
  delete(calendar: any) {
    if (!confirm('¿Eliminar calendario?')) return;

    this.http.delete(`${this.api}/${calendar.id}`)
      .subscribe(() => {
        this.loadCalendars();
      });
  }

  // =============================
  // 🔄 Reset
  // =============================
  resetFormulario() {
    this.titulo = '';
    this.selectedFile = undefined as any;
    this.modoEdicion = false;
    this.calendarioEditando = null;
    this.archivoNombre = '';  // ✅ limpiar nombre del archivo
    this.mensaje = '';
  }
}