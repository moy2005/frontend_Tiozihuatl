import { Component, OnInit, ViewEncapsulation, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { NewsService } from '../../../api/services/news.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-gestion-noticias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './gestion-noticias.html',
  styleUrls: ['./gestion-noticias.css'],
  encapsulation: ViewEncapsulation.None
})
export class GestionNoticiasComponent implements OnInit {

  @ViewChild('imagenInput') imagenInput!: ElementRef<HTMLInputElement>;
  @ViewChild('videoInput') videoInput!: ElementRef<HTMLInputElement>;

  noticias: any[] = [];
  editando = false;
  cargando = false;
  guardando = false;
  mensajeCarga = 'Guardando noticia...';
  mostrarDetalles = false;
  noticiaSeleccionada: any = null;

  imagenFile: File | null = null;
  videoFile: File | null = null;
  imagenPreview: string | null = null;
  videoPreview: string | null = null;

  noticiaForm: any = this.crearFormularioVacio();

  constructor(private newsService: NewsService) {}

  ngOnInit() {
    this.cargarNoticias();
  }

  private crearFormularioVacio() {
    return {
      id_noticia: null,
      titulo: '',
      contenido: '',
      categoria: '',
      modo_publicacion: 'ahora',
      fecha_publicacion: '',
      fecha_caducidad: '',
      estado: 'Borrador',
      imagen_url: '',
      video_url: ''
    };
  }

  parseFechaUTC(fecha: string | null): Date | null {
    if (!fecha) return null;
    try {
      const str = fecha.toString().replace(' ', 'T').replace(/Z+$/, '') + 'Z';
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  async cargarNoticias() {
    this.cargando = true;
    try {
      this.noticias = await firstValueFrom(this.newsService.getAll());
    } catch (error) {
      console.error('Error al cargar noticias:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las noticias.',
        confirmButtonColor: '#2196F3'
      });
    } finally {
      this.cargando = false;
    }
  }

  nuevaNoticia() {
    this.editando = true;
    this.limpiarFormulario();
  }

  private obtenerModoPublicacionInicial(noticia: any): 'ahora' | 'programada' {
    const fechaPublicacion = noticia?.fecha_publicacion ? new Date(noticia.fecha_publicacion) : null;
    const esFechaValida = fechaPublicacion && !isNaN(fechaPublicacion.getTime());

    if (noticia?.estado === 'Borrador' && esFechaValida && fechaPublicacion > new Date()) {
      return 'programada';
    }

    return 'ahora';
  }

  onModoPublicacionChange() {
    if (this.noticiaForm.modo_publicacion !== 'programada') {
      return;
    }

    const fechaProgramada = this.noticiaForm.fecha_publicacion
      ? new Date(this.noticiaForm.fecha_publicacion)
      : null;

    if (!fechaProgramada || isNaN(fechaProgramada.getTime()) || fechaProgramada < new Date()) {
      const siguienteMinuto = new Date();
      siguienteMinuto.setMinutes(siguienteMinuto.getMinutes() + 1);
      this.noticiaForm.fecha_publicacion = this.convertirFechaADatetimeLocal(siguienteMinuto);
    }
  }

  editarNoticia(noticia: any) {
    if (noticia.estado === 'Inactiva') {
      Swal.fire({
        icon: 'info',
        title: 'Noticia inactiva',
        text: 'Esta noticia está inactiva. Para reactivarla, actualiza las fechas de publicación y caducidad.',
        confirmButtonColor: '#2196F3'
      });
    }

    const modoPublicacion = this.obtenerModoPublicacionInicial(noticia);

    this.editando = true;
    this.limpiarPreviews();
    this.noticiaForm = {
      ...this.crearFormularioVacio(),
      ...noticia,
      modo_publicacion: modoPublicacion,
      fecha_publicacion:
        modoPublicacion === 'programada' && noticia.fecha_publicacion
          ? this.convertirFechaADatetimeLocal(noticia.fecha_publicacion)
          : '',
      fecha_caducidad: noticia.fecha_caducidad
        ? this.convertirFechaADatetimeLocal(noticia.fecha_caducidad)
        : ''
    };
  }

  verDetalles(noticia: any) {
    this.noticiaSeleccionada = noticia;
    this.mostrarDetalles = true;
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.noticiaSeleccionada = null;
  }

  onImagenChange(event: any) {
    const file = event.target.files[0];

    if (file) {
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo inválido',
          text: 'Por favor seleccione un archivo de imagen válido.',
          confirmButtonColor: '#2196F3'
        });
        event.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo muy grande',
          text: 'La imagen no puede superar los 5MB.',
          confirmButtonColor: '#2196F3'
        });
        event.target.value = '';
        return;
      }

      this.imagenFile = file;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagenPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onVideoChange(event: any) {
    const file = event.target.files[0];

    if (file) {
      if (!file.type.startsWith('video/')) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo inválido',
          text: 'Por favor seleccione un archivo de video válido.',
          confirmButtonColor: '#2196F3'
        });
        event.target.value = '';
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo muy grande',
          text: 'El video no puede superar los 50MB.',
          confirmButtonColor: '#2196F3'
        });
        event.target.value = '';
        return;
      }

      this.videoFile = file;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.videoPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  limpiarImagen() {
    this.imagenFile = null;
    this.imagenPreview = null;
    if (this.imagenInput) {
      this.imagenInput.nativeElement.value = '';
    }
  }

  limpiarVideo() {
    this.videoFile = null;
    this.videoPreview = null;
    if (this.videoInput) {
      this.videoInput.nativeElement.value = '';
    }
  }

  limpiarPreviews() {
    this.limpiarImagen();
    this.limpiarVideo();
  }

  limpiarFormulario() {
    this.noticiaForm = this.crearFormularioVacio();
    this.limpiarPreviews();
  }

  validarFormulario(): boolean {
    if (!this.noticiaForm.titulo?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Por favor ingrese el título de la noticia.', confirmButtonColor: '#2196F3' });
      return false;
    }

    if (!this.noticiaForm.contenido?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Por favor ingrese el contenido de la noticia.', confirmButtonColor: '#2196F3' });
      return false;
    }

    if (!this.noticiaForm.fecha_caducidad) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Por favor seleccione la fecha de caducidad.', confirmButtonColor: '#2196F3' });
      return false;
    }

    const ahora = new Date();
    const tolerancia = 5 * 60 * 1000;
    let pub = new Date();
    const cad = new Date(this.noticiaForm.fecha_caducidad);

    if (this.noticiaForm.modo_publicacion === 'programada') {
      if (!this.noticiaForm.fecha_publicacion) {
        Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Por favor seleccione la fecha de publicación.', confirmButtonColor: '#2196F3' });
        return false;
      }

      pub = new Date(this.noticiaForm.fecha_publicacion);

      if (pub < new Date(ahora.getTime() - tolerancia)) {
        Swal.fire({ icon: 'warning', title: 'Fecha inválida', text: 'La fecha de publicación no puede ser en el pasado.', confirmButtonColor: '#2196F3' });
        return false;
      }
    }

    const maxFuturo = new Date(ahora);
    maxFuturo.setFullYear(maxFuturo.getFullYear() + 2);

    if (this.noticiaForm.modo_publicacion === 'programada' && pub > maxFuturo) {
      Swal.fire({ icon: 'warning', title: 'Fecha inválida', text: 'La fecha de publicación no puede ser más de 2 años en el futuro.', confirmButtonColor: '#2196F3' });
      return false;
    }

    if (cad <= pub) {
      Swal.fire({ icon: 'warning', title: 'Fechas inválidas', text: 'La fecha de caducidad debe ser posterior a la fecha de publicación.', confirmButtonColor: '#2196F3' });
      return false;
    }

    if (cad > maxFuturo) {
      Swal.fire({ icon: 'warning', title: 'Fecha inválida', text: 'La fecha de caducidad no puede ser más de 2 años en el futuro.', confirmButtonColor: '#2196F3' });
      return false;
    }

    return true;
  }

  async guardarNoticia() {
    if (!this.validarFormulario()) return;

    this.guardando = true;

    try {
      const formData = new FormData();

      Object.keys(this.noticiaForm).forEach(key => {
        if (
          this.noticiaForm[key] !== null &&
          this.noticiaForm[key] !== undefined &&
          key !== 'imagen_url' &&
          key !== 'video_url' &&
          key !== 'estado' &&
          key !== 'modo_publicacion' &&
          key !== 'fecha_publicacion' &&
          key !== 'fecha_caducidad'
        ) {
          formData.append(key, this.noticiaForm[key]);
        }
      });

      formData.append('modo_publicacion', this.noticiaForm.modo_publicacion);

      if (this.noticiaForm.modo_publicacion === 'programada' && this.noticiaForm.fecha_publicacion) {
        formData.append('fecha_publicacion', this.noticiaForm.fecha_publicacion.replace('T', ' '));
      }

      if (this.noticiaForm.fecha_caducidad) {
        formData.append('fecha_caducidad', this.noticiaForm.fecha_caducidad.replace('T', ' '));
      }

      formData.append('imagen_url', this.noticiaForm.imagen_url ?? '');
      formData.append('video_url', this.noticiaForm.video_url ?? '');

      if (this.imagenFile && this.videoFile) {
        this.mensajeCarga = 'Subiendo imagen y video...';
      } else if (this.imagenFile) {
        this.mensajeCarga = 'Subiendo imagen...';
      } else if (this.videoFile) {
        this.mensajeCarga = 'Subiendo video...';
      } else {
        this.mensajeCarga = 'Guardando noticia...';
      }

      if (this.imagenFile) formData.append('imagen', this.imagenFile);
      if (this.videoFile) formData.append('video', this.videoFile);

      if (this.noticiaForm.id_noticia) {
        await firstValueFrom(this.newsService.update(this.noticiaForm.id_noticia, formData));
        Swal.fire({ icon: 'success', title: 'Actualizada', text: 'Noticia actualizada correctamente.', confirmButtonColor: '#2196F3', timer: 2000 });
      } else {
        await firstValueFrom(this.newsService.create(formData));
        Swal.fire({ icon: 'success', title: 'Creada', text: 'Noticia creada correctamente.', confirmButtonColor: '#2196F3', timer: 2000 });
      }

      this.editando = false;
      this.limpiarFormulario();
      await this.cargarNoticias();

    } catch (error) {
      const mensaje = (error instanceof HttpErrorResponse && error.error?.message)
        ? error.error.message
        : 'No se pudo guardar la noticia. Por favor intente nuevamente.';

      Swal.fire({ icon: 'error', title: 'Error', text: mensaje, confirmButtonColor: '#2196F3' });
    } finally {
      this.guardando = false;
    }
  }

  eliminarNoticia(id: number) {
    Swal.fire({
      title: '¿Eliminar noticia?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2196F3',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await firstValueFrom(this.newsService.delete(id));
          Swal.fire({ icon: 'success', title: 'Eliminada', text: 'La noticia ha sido eliminada.', confirmButtonColor: '#2196F3', timer: 2000 });
          await this.cargarNoticias();
        } catch (error) {
          const mensaje = (error instanceof HttpErrorResponse && error.error?.message)
            ? error.error.message
            : 'No se pudo eliminar la noticia.';

          Swal.fire({ icon: 'error', title: 'Error', text: mensaje, confirmButtonColor: '#2196F3' });
        }
      }
    });
  }

  cancelar() {
    this.editando = false;
    this.limpiarFormulario();
  }

  convertirFechaADatetimeLocal(fecha: string | Date): string {
    const fechaObj = new Date(fecha);
    const offset = fechaObj.getTimezoneOffset();
    const fechaLocal = new Date(fechaObj.getTime() - (offset * 60 * 1000));
    return fechaLocal.toISOString().slice(0, 16);
  }
}
