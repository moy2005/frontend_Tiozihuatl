import { Component,CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {CatalogAdminService, LibroAdmin} from '../../../api/services/admin.catalog.service';
import { StorageService } from '../../../api/services/storage.service';
import { CloudinaryService } from '../../../api/services/cloudinary.service';

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

    // NUEVO MODELO
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
  mensaje = '';

  formatosEditados = false;

  /** Modo edición */
  modoEdicion = false;
  libroEditandoId: number | null = null;

  mostrarModal = false;
  mostrarFormulario = true;

  mensajeErrorArchivo: string = '';
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
  this.catalogAdminService.obtenerLibros().subscribe({
    next: res => {
      this.libros = res.map(libro => ({
        ...libro,
        activo: Number(libro.activo) === 1 ? 1 : 0
      }));
    },
    error: () => this.mensaje = 'Error al cargar libros'
  });
}
  /** 📄 Capturar PDF */
  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // 🔹 Validar tipo
    if (file.type !== 'application/pdf') {
      this.mensajeErrorArchivo = 'Solo se permiten archivos PDF';
      this.pdfSeleccionado = null;
      input.value = '';
      return;
    }

    // 🔹 Validar tamaño (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB en bytes

    if (file.size > maxSize) {
      this.mensajeErrorArchivo =
        'El archivo supera los 10MB permitidos por el plan actual.';
      this.pdfSeleccionado = null;
      input.value = '';
      return;
    }

    // 🔹 Si todo está bien
    this.mensajeErrorArchivo = '';
    this.pdfSeleccionado = file;
  }

  /** 💾 Guardar libro (crear o editar) */
  guardarLibro(): void {

    if (this.modoEdicion) {
      this.actualizarLibro();
      return;
    }

    // VALIDACIONES
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

    // 🧠 CONSTRUIR FORMATOS
    const formatos: any[] = [];

    if (this.nuevoLibro.tiene_fisico) {
      formatos.push({
        tipo: 'FISICO',
        total: this.nuevoLibro.total,
        disponibles: this.nuevoLibro.total
      });
    }

    // 📌 CASO: SOLO FÍSICO
    if (this.nuevoLibro.tiene_fisico && !this.nuevoLibro.tiene_digital) {
      this.catalogAdminService.crearLibro({
        titulo: this.nuevoLibro.titulo,
        autor: this.nuevoLibro.autor,
        editorial: this.nuevoLibro.editorial,
        materias: [this.nuevoLibro.materia_id],
        formatos
      }).subscribe({
        next: () => this.finalizarGuardado(),
        error: () => this.errorGuardado()
      });
      return;
    }

    // 📌 CASO: DIGITAL (o ambos)
    this.storageService.uploadPdf(this.pdfSeleccionado!).subscribe({
    next: (res: any) => {

      formatos.push({
        tipo: 'DIGITAL',
        pdf_url: res.public_id   // 👈 AQUÍ ESTÁ EL CAMBIO IMPORTANTE
      });

        this.catalogAdminService.crearLibro({
          titulo: this.nuevoLibro.titulo,
          autor: this.nuevoLibro.autor,
          editorial: this.nuevoLibro.editorial,
          materias: [this.nuevoLibro.materia_id],
          formatos
        }).subscribe({
          next: () => this.finalizarGuardado(),
          error: () => this.errorGuardado()
        });
      },
      error: () => {
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
      materia_id: libro.materia_id,

      tiene_fisico: !!formatoFisico,
      tiene_digital: !!formatoDigital,

      total: formatoFisico?.total ?? 0
    };

    this.pdfActual = formatoDigital?.pdf_url ?? null;

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
      materias: [this.nuevoLibro.materia_id],

      // 🔹 SIEMPRE enviar formatos actuales
      tiene_fisico: this.nuevoLibro.tiene_fisico ? 1 : 0,
      tiene_digital: this.nuevoLibro.tiene_digital ? 1 : 0,
      total: this.nuevoLibro.total
    };

    // 🔹 Si hay nuevo PDF → subir primero
    if (this.pdfSeleccionado) {

      this.storageService.uploadPdf(this.pdfSeleccionado).subscribe({
  next: (res: any) => {
    payload.pdf_url = res.public_id;   
          this.enviarUpdate(payload);
        },
        error: () => {
          this.mensaje = 'Error al subir el PDF';
          this.cargando = false;
        }
      });

      return;
    }

    // 🔹 Si mantiene digital pero no cambió PDF
    if (this.nuevoLibro.tiene_digital) {
      payload.pdf_url = this.pdfActual;
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
          
          // ✅ CERRAR MODAL DESPUÉS DE ACTUALIZAR
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
    
    // ✅ CERRAR MODAL DESPUÉS DE CREAR
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