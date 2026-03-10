import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
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

  libros: LibroAdmin[] = [];

  nuevoLibro: any = {
    titulo: '',
    autores: '',
    editorial: '',
    materia_id: null,
    tiene_fisico: false,
    tiene_digital: false,
    total: 0
  };

  materias: any[] = [];
  pdfSeleccionado: File | null = null;
  pdfActual: string | null = null;

  cargando      = false;
  cargandoTabla = false;
  mensaje       = '';
  formatosEditados = false;

  modoEdicion      = false;
  libroEditandoId: number | null = null;
  mostrarModal     = false;
  mostrarFormulario = true;

  mensajeErrorArchivo: string = '';
  archivoSeleccionado: File | null = null;
  totalResultados: number = 0;
  filtros = {
  search: '',
  materia: '',
  formato: '',
  activo: '',
  ordenAutor: ''};

  constructor(
    private catalogAdminService: CatalogAdminService,
    private storageService: StorageService
  ) {}

  ngOnInit(): void {
    this.cargarLibros();
    this.cargarMaterias();
  }

  // ─────────────────────────────────────────
  // CARGAR LIBROS
  // ─────────────────────────────────────────
  cargarLibros(): void {
    this.cargandoTabla = true;
    this.catalogAdminService.obtenerLibros(this.filtros).subscribe({
      next: (res) => {
        this.libros = res.map((libro: any) => ({
          ...libro,
          activo:        Number(libro.activo)        === 1 ? 1 : 0,
          tiene_fisico:  Number(libro.tiene_fisico)  === 1 ? 1 : 0,
          tiene_digital: Number(libro.tiene_digital) === 1 ? 1 : 0,
        }));

        this.totalResultados = this.libros.length;

        this.cargandoTabla = false;
      },
      error: () => {
        this.cargandoTabla = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los libros.',
          confirmButtonColor: '#1976D2'
        });
      }
    });
  }
  // ─────────────────────────────────────────
  // AUTORES DINÁMICOS
  // ─────────────────────────────────────────
  agregarAutor(): void {
    this.nuevoLibro.autores.push('');
  }

  eliminarAutor(index: number): void {
    if (this.nuevoLibro.autores.length > 1) {
      this.nuevoLibro.autores.splice(index, 1);
    }
  }

  // ─────────────────────────────────────────
  // APLICAR FILTROS
  // ─────────────────────────────────────────
  aplicarFiltros(): void {
  this.cargarLibros();
  }
  
  // ─────────────────────────────────────────
  // BUSCAR
  // ─────────────────────────────────────────

  buscar(): void {
    this.cargarLibros();
  }

  // ─────────────────────────────────────────
  // CARGAR MATERIAS
  // ─────────────────────────────────────────
  cargarMaterias(): void {
    this.catalogAdminService.obtenerMaterias().subscribe({
      next: (res) => { this.materias = res; },
      error: (err) => { console.error('Error al cargar materias', err); }
    });
  }

  // ─────────────────────────────────────────
  // CAPTURAR PDF
  // ─────────────────────────────────────────
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

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      this.mensajeErrorArchivo = 'El archivo supera los 100MB permitidos por el plan actual.';
      this.pdfSeleccionado = null;
      input.value = '';
      return;
    }

    this.mensajeErrorArchivo = '';
    this.pdfSeleccionado = file;
  }

  // ─────────────────────────────────────────
  // GUARDAR (crear o editar)
  // ─────────────────────────────────────────
  guardarLibro(): void {
    if (this.modoEdicion) {
      this.actualizarLibro();
      return;
    }

    // Validaciones con Swal
    if (!this.nuevoLibro.materia_id) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Debes seleccionar una materia.', confirmButtonColor: '#1976D2' });
      return;
    }

    if (!this.nuevoLibro.tiene_fisico && !this.nuevoLibro.tiene_digital) {
      Swal.fire({ icon: 'warning', title: 'Formato requerido', text: 'Debes seleccionar al menos un formato (Físico o Digital).', confirmButtonColor: '#1976D2' });
      return;
    }

    if (this.nuevoLibro.tiene_fisico && this.nuevoLibro.total <= 0) {
      Swal.fire({ icon: 'warning', title: 'Stock inválido', text: 'El libro físico debe tener al menos 1 ejemplar.', confirmButtonColor: '#1976D2' });
      return;
    }

    if (this.nuevoLibro.tiene_digital && !this.pdfSeleccionado) {
      Swal.fire({ icon: 'warning', title: 'PDF requerido', text: 'Debes subir el archivo PDF para el formato digital.', confirmButtonColor: '#1976D2' });
      return;
    }

    this.cargando = true;
    this.mensaje  = '';
    // Convertir autores a string
    this.nuevoLibro.autor = this.nuevoLibro.autores
      .map((a: string) => a.trim())
      .filter((a: string) => a)
      .join('; ');
    const formatos: any[] = [];

    if (this.nuevoLibro.tiene_fisico) {
      formatos.push({
        tipo:       'FISICO',
        total:      this.nuevoLibro.total,
        disponibles: this.nuevoLibro.total
      });
    }

    // CASO: SOLO FÍSICO
    if (this.nuevoLibro.tiene_fisico && !this.nuevoLibro.tiene_digital) {
      this.catalogAdminService.crearLibro({
        titulo:    this.nuevoLibro.titulo,
        autor:     this.nuevoLibro.autor,
        editorial: this.nuevoLibro.editorial,
        materias:  [this.nuevoLibro.materia_id],
        formatos
      }).subscribe({
        next:  () => this.finalizarGuardado(),
        error: () => this.errorGuardado()
      });
      return;
    }

    // CASO: DIGITAL (o ambos)
    this.storageService.uploadPdf(this.pdfSeleccionado!).subscribe({
      next: (res: any) => {
        formatos.push({ tipo: 'DIGITAL', pdf_url: res.public_id });

        this.catalogAdminService.crearLibro({
          titulo:    this.nuevoLibro.titulo,
          autor:     this.nuevoLibro.autor,
          editorial: this.nuevoLibro.editorial,
          materias:  [this.nuevoLibro.materia_id],
          formatos
        }).subscribe({
          next:  () => this.finalizarGuardado(),
          error: () => this.errorGuardado()
        });
      },
      error: () => {
        this.cargando = false;
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo subir el PDF. Intenta de nuevo.', confirmButtonColor: '#1976D2' });
      }
    });
  }

  // ─────────────────────────────────────────
  // EDITAR
  // ─────────────────────────────────────────
  editarLibro(libro: any): void {
    
    this.mostrarModal    = true;
    this.modoEdicion     = true;
    this.libroEditandoId = libro.id;

    const formatoFisico  = libro.formatos?.find((f: any) => f.tipo === 'FISICO');
    const formatoDigital = libro.formatos?.find((f: any) => f.tipo === 'DIGITAL');

    const materiaEncontrada = this.materias.find(
      (m: any) => m.nombre === libro.materias
    );
    const primerMateriaId = materiaEncontrada ? Number(materiaEncontrada.id) : null;
    this.nuevoLibro = {
      titulo:        libro.titulo,
      autor: libro.autor,
      autores: libro.autor ? libro.autor.split(';').map((a: string) => a.trim()) : [''],
      editorial:     libro.editorial,
      materia_id:    null, 
      tiene_fisico:  libro.tiene_fisico === 1,
      tiene_digital: libro.tiene_digital === 1,
      total:         libro.total ?? 0
    };

    setTimeout(() => {
      this.nuevoLibro.materia_id = primerMateriaId;
    }, 0);

    this.pdfActual       = libro.pdf_url ?? null;
    this.pdfSeleccionado = null;
    this.formatosEditados = false;
  }

  // ─────────────────────────────────────────
  // ACTUALIZAR
  // ─────────────────────────────────────────
  actualizarLibro(): void {
    if (!this.libroEditandoId) return;

    if (!this.nuevoLibro.materia_id) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Debes seleccionar una materia.', confirmButtonColor: '#1976D2' });
      return;
    }

    this.cargando = true;
    this.mensaje  = '';
    this.nuevoLibro.autor = this.nuevoLibro.autores
    .map((a: string) => a.trim())
    .filter((a: string) => a)
    .join('; ');

    const payload: any = {
      titulo:        this.nuevoLibro.titulo,
      autor:         this.nuevoLibro.autor,
      editorial:     this.nuevoLibro.editorial,
      materias:      [Number(this.nuevoLibro.materia_id)],
      tiene_fisico:  this.nuevoLibro.tiene_fisico  ? 1 : 0,
      tiene_digital: this.nuevoLibro.tiene_digital ? 1 : 0,
      total:         this.nuevoLibro.total
    };

    if (this.pdfSeleccionado) {
      this.storageService.uploadPdf(this.pdfSeleccionado).subscribe({
        next: (res: any) => {
          payload.pdf_url = res.public_id;
          this.enviarUpdate(payload);
        },
        error: () => {
          this.cargando = false;
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo subir el PDF. Intenta de nuevo.', confirmButtonColor: '#1976D2' });
        }
      });
      return;
    }

    if (this.nuevoLibro.tiene_digital) {
      payload.pdf_url = this.pdfActual;
    }

    this.enviarUpdate(payload);
  }

  private enviarUpdate(payload: any): void {
    this.catalogAdminService.actualizarLibro(this.libroEditandoId!, payload).subscribe({
      next: () => {
        this.cargando = false;
        this.resetFormulario();
        this.cerrarModal();
        this.cargarLibros();
        Swal.fire({
          icon:              'success',
          title:             '¡Actualizado!',
          text:              'El libro fue actualizado correctamente.',
          confirmButtonColor: '#1976D2',
          timer:             2000,
          showConfirmButton: false
        });
      },
      error: () => {
        this.cargando = false;
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el libro.', confirmButtonColor: '#1976D2' });
      }
    });
  }

  // ─────────────────────────────────────────
  // CAMBIAR ESTADO con confirmación
  // ─────────────────────────────────────────
  cambiarEstado(libro: any): void {
    const nuevoEstado = libro.activo === 1 ? 0 : 1;
    const accion      = nuevoEstado === 1 ? 'activar' : 'desactivar';
    const accionPasado = nuevoEstado === 1 ? 'activado' : 'desactivado';

    Swal.fire({
      title:             `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} libro?`,
      text:              `El libro "${libro.titulo}" será ${accionPasado}.`,
      icon:              'question',
      showCancelButton:  true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText:  'Cancelar',
      confirmButtonColor: nuevoEstado === 1 ? '#4CAF50' : '#F44336',
      cancelButtonColor:  '#607D8B'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.catalogAdminService.cambiarEstado(libro.id, nuevoEstado).subscribe({
        next: () => {
          libro.activo = nuevoEstado;
          Swal.fire({
            icon:              'success',
            title:             `Libro ${accionPasado}`,
            timer:             1500,
            showConfirmButton: false
          });
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el estado.', confirmButtonColor: '#1976D2' });
        }
      });
    });
  }

  // ─────────────────────────────────────────
  // FINALIZAR GUARDADO
  // ─────────────────────────────────────────
  finalizarGuardado(): void {
    this.cargando = false;
    this.resetFormulario();
    this.cerrarModal();
    this.cargarLibros();
    Swal.fire({
      icon:              'success',
      title:             '¡Libro creado!',
      text:              'El libro fue registrado correctamente.',
      confirmButtonColor: '#1976D2',
      timer:             2000,
      showConfirmButton: false
    });
  }

  errorGuardado(): void {
    this.cargando = false;
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar el libro. Intenta de nuevo.', confirmButtonColor: '#1976D2' });
  }

  // ─────────────────────────────────────────
  // RESET / MODAL
  // ─────────────────────────────────────────
  resetFormulario(): void {
    this.modoEdicion     = false;
    this.libroEditandoId = null;
    this.pdfActual       = null;
    this.formatosEditados = false;
    this.mensajeErrorArchivo = '';

    this.nuevoLibro = {
      titulo:        '',
      autor:         '',
      autores: [''], 
      editorial:     '',
      materia_id:    null,
      tiene_fisico:  false,
      tiene_digital: false,
      total:         0
    };
    this.pdfSeleccionado = null;
  }

  trackAutor(index: number, item: string) {
    return index;
  }

  abrirModal(): void {
    this.mostrarModal = true;
    this.modoEdicion  = false;
    this.resetFormulario();
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.resetFormulario();
  }
  
  limpiarFiltros() {

  this.filtros = {
    search: '',
    materia: '',
    formato: '',
    activo: '',
    ordenAutor: ''
  };

  this.cargarLibros();

}
}