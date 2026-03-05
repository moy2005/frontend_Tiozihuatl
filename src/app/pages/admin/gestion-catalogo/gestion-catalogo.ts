import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs/operators';

import { CatalogAdminService, LibroAdmin } from '../../../api/services/admin.catalog.service';
import { StorageService } from '../../../api/services/storage.service';

@Component({
  selector: 'app-catalogo-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-catalogo.html',
  styleUrls: ['./gestion-catalogo.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionCatalogoComponent implements OnInit {
  /** 📚 Libros (vista admin) */
  libros: LibroAdmin[] = [];

  /** 📘 Materias */
  materias = [
    { id: 1, nombre: 'Anatomía' },
    { id: 2, nombre: 'Fisiología' },
    { id: 3, nombre: 'Farmacología' },
    { id: 4, nombre: 'Enfermería Básica' },
    { id: 5, nombre: 'Pediatría' }
  ];

  /** 📝 Modelo del formulario */
  nuevoLibro: any = {
    titulo: '',
    autor: '',
    editorial: '',
    materia_id: 0,
    tiene_fisico: false,
    tiene_digital: false,
    total: 0
  };

  /** 📄 PDF nuevo seleccionado */
  pdfSeleccionado: File | null = null;

  /** 📎 PDF actual (en edición) */
  pdfActual: string | null = null;

  /** UI state */
  cargando = false;
  cargandoTabla = false; // 👈 LOADING DE TABLA
  mensaje = '';
  mensajeErrorArchivo: string = '';

  formatosEditados = false;

  /** Modo edición */
  modoEdicion = false;
  libroEditandoId: number | null = null;

  mostrarModal = false;
  mostrarFormulario = true;
  archivoSeleccionado: File | null = null;

  constructor(
    private catalogAdminService: CatalogAdminService,
    private storageService: StorageService
  ) {}

  ngOnInit(): void {
    this.cargarLibros();
  }

  /** 📚 Cargar libros (admin) */
  cargarLibros(): void {
    this.cargandoTabla = true; // 👈 ACTIVAR LOADING
    this.catalogAdminService.obtenerLibros().subscribe({
      next: (res) => {
        this.libros = res.map((libro: any) => ({
          ...libro,
          activo: Number(libro.activo) === 1 ? 1 : 0,
          tiene_fisico: libro.total ? 1 : 0,
          tiene_digital: libro.url_pdf ? 1 : 0,
          materia_id: libro.categoria_id,
          materia: this.getNombreMateria(libro.categoria_id)
        }));
        this.cargandoTabla = false; // 👈 DESACTIVAR LOADING
      },
      error: () => {
        this.mensaje = 'Error al cargar libros';
        this.cargandoTabla = false; // 👈 DESACTIVAR LOADING EN ERROR
      }
    });
  }

  getNombreMateria(categoriaId: number): string {
    const materia = this.materias.find(m => m.id === categoriaId);
    return materia ? materia.nombre : 'Sin materia';
  }

  /** 📄 Capturar PDF */
  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    if (file.type !== 'application/pdf') {
      this.mensajeErrorArchivo = 'Solo se permiten archivos PDF';
      this.pdfSeleccionado = null;
      input.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      this.mensajeErrorArchivo = 'El archivo supera los 10MB permitidos.';
      this.pdfSeleccionado = null;
      input.value = '';
      return;
    }

    this.mensajeErrorArchivo = '';
    this.pdfSeleccionado = file;
  }

  /** 💾 Guardar libro (crear o editar) */
  guardarLibro(): void {
    if (this.modoEdicion) {
      this.actualizarLibro();
      return;
    }

    if (!this.nuevoLibro.tiene_fisico && !this.nuevoLibro.tiene_digital) {
      this.mensaje = 'Debes seleccionar al menos un formato';
      return;
    }

    if (this.nuevoLibro.tiene_fisico && this.nuevoLibro.total <= 0) {
      this.mensaje = 'El libro físico debe tener stock';
      return;
    }

    if (this.nuevoLibro.tiene_digital && !this.pdfSeleccionado) {
      this.mensaje = 'Debes subir el PDF para el formato digital';
      return;
    }

    this.cargando = true;
    this.mensaje = '';

    if (this.nuevoLibro.tiene_fisico && !this.nuevoLibro.tiene_digital) {
      const libroData = {
        titulo: this.nuevoLibro.titulo,
        autor: this.nuevoLibro.autor,
        editorial: this.nuevoLibro.editorial,
        categoria_id: this.nuevoLibro.materia_id,
        url_pdf: null,
        total: this.nuevoLibro.total
      };

      this.catalogAdminService.crearLibro(libroData).subscribe({
        next: () => this.finalizarGuardado(),
        error: (error) => {
          console.error('❌ Error:', error);
          this.errorGuardado();
        }
      });
      return;
    }

    this.storageService.uploadPdf(this.pdfSeleccionado!).subscribe({
      next: (res) => {
        const urlPdf = res?.data?.secure_url || (res as any)?.secure_url;

        const libroData: any = {
          titulo: this.nuevoLibro.titulo,
          autor: this.nuevoLibro.autor,
          editorial: this.nuevoLibro.editorial,
          categoria_id: this.nuevoLibro.materia_id,
          url_pdf: urlPdf
        };

        if (this.nuevoLibro.tiene_fisico) {
          libroData.total = this.nuevoLibro.total;
        }

        this.catalogAdminService.crearLibro(libroData).subscribe({
          next: () => this.finalizarGuardado(),
          error: (error) => {
            console.error('❌ Error al crear libro:', error);
            this.errorGuardado();
          }
        });
      },
      error: (error) => {
        console.error('❌ Error al subir PDF:', error);
        this.mensaje = 'Error al subir el PDF';
        this.cargando = false;
      }
    });
  }

  /** ✏️ Editar libro */
  editarLibro(libro: any): void {
    this.mostrarModal = true;
    this.modoEdicion = true;
    this.libroEditandoId = libro.id;

    const formatoFisico = libro.formatos?.find((f: any) => f.tipo === 'FISICO');
    const formatoDigital = libro.formatos?.find((f: any) => f.tipo === 'DIGITAL');

    this.nuevoLibro = {
      titulo: libro.titulo,
      autor: libro.autor,
      editorial: libro.editorial,
      materia_id: libro.categoria_id || 0,
      tiene_fisico: !!formatoFisico || !!libro.total,
      tiene_digital: !!formatoDigital || !!libro.url_pdf,
      total: formatoFisico?.total || libro.total || 0
    };

    this.pdfActual = formatoDigital?.pdf_url || libro.url_pdf || null;
    this.pdfSeleccionado = null;
    this.formatosEditados = false;
  }

  /** 🔄 Actualizar libro */
  actualizarLibro(): void {
    if (!this.libroEditandoId) return;

    this.cargando = true;
    this.mensaje = '';

    const payload: any = {
      titulo: this.nuevoLibro.titulo,
      autor: this.nuevoLibro.autor,
      editorial: this.nuevoLibro.editorial,
      categoria_id: this.nuevoLibro.materia_id,
      total: this.nuevoLibro.tiene_fisico ? this.nuevoLibro.total : null
    };

    if (this.pdfSeleccionado) {
      this.storageService.uploadPdf(this.pdfSeleccionado).subscribe({
        next: (res) => {
          payload.url_pdf = res?.data?.secure_url || (res as any)?.secure_url;
          this.enviarUpdate(payload);
        },
        error: () => {
          this.mensaje = 'Error al subir el PDF';
          this.cargando = false;
        }
      });
      return;
    }

    if (this.nuevoLibro.tiene_digital) {
      payload.url_pdf = this.pdfActual;
    }

    this.enviarUpdate(payload);
  }

  private enviarUpdate(payload: any) {
    this.catalogAdminService
      .actualizarLibro(this.libroEditandoId!, payload)
      .subscribe({
        next: () => {
          this.mensaje = 'Libro actualizado correctamente';
          this.resetFormulario();
          this.cargarLibros();
          this.cargando = false;
          this.cerrarModal();
        },
        error: () => {
          this.mensaje = 'Error al actualizar libro';
          this.cargando = false;
        }
      });
  }

  /** 🔄 Activar / Desactivar */
  cambiarEstado(libro: any) {
    const nuevoEstado = libro.activo === 1 ? 0 : 1;

    this.catalogAdminService
      .cambiarEstado(libro.id, nuevoEstado)
      .subscribe({
        next: () => {
          libro.activo = nuevoEstado;
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  /** ✅ Finalizar guardado */
  finalizarGuardado(): void {
    this.mensaje = 'Libro registrado correctamente';
    this.resetFormulario();
    this.cargarLibros();
    this.cargando = false;
    this.cerrarModal();
  }

  /** ❌ Error */
  errorGuardado(): void {
    this.mensaje = 'Error al guardar libro';
    this.cargando = false;
  }

  /** ♻️ Reset */
  resetFormulario(): void {
    this.modoEdicion = false;
    this.libroEditandoId = null;
    this.pdfActual = null;
    this.formatosEditados = false;

    this.nuevoLibro = {
      titulo: '',
      autor: '',
      editorial: '',
      materia_id: 0,
      tiene_fisico: false,
      tiene_digital: false,
      total: 0
    };
    this.pdfSeleccionado = null;
  }

  abrirModal(): void {
    this.mostrarModal = true;
    this.modoEdicion = false;
    this.resetFormulario();
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.resetFormulario();
  }
}