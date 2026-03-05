import { Component, OnInit, ViewEncapsulation, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  noticiaForm: any = {
    id_noticia: null,
    titulo: '',
    contenido: '',
    categoria: '',
    fecha_publicacion: '',
    fecha_caducidad: '',
    estado: 'Borrador',
    imagen_url: '',
    video_url: ''
  };

  constructor(private newsService: NewsService) {}

  ngOnInit() {
    this.cargarNoticias();
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

  editarNoticia(noticia: any) {
    this.editando = true;
    this.limpiarPreviews();
    
    // Copiar los datos de la noticia
    this.noticiaForm = { ...noticia };
    
    // Convertir las fechas al formato datetime-local si existen
    if (this.noticiaForm.fecha_publicacion) {
      this.noticiaForm.fecha_publicacion = this.convertirFechaADatetimeLocal(this.noticiaForm.fecha_publicacion);
    }
    
    if (this.noticiaForm.fecha_caducidad) {
      this.noticiaForm.fecha_caducidad = this.convertirFechaADatetimeLocal(this.noticiaForm.fecha_caducidad);
    }
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
      // Validar que sea una imagen
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

      // Validar tamaño (máximo 5MB)
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
      
      // Crear vista previa
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
      // Validar que sea un video
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

      // Validar tamaño (máximo 50MB)
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
      
      // Crear vista previa
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
    this.noticiaForm = {
      id_noticia: null,
      titulo: '',
      contenido: '',
      categoria: '',
      fecha_publicacion: '',
      fecha_caducidad: '',
      estado: 'Borrador',
      imagen_url: '',
      video_url: ''
    };
    this.limpiarPreviews();
  }

  validarFormulario(): boolean {
    if (!this.noticiaForm.titulo?.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Por favor ingrese el título de la noticia.',
        confirmButtonColor: '#2196F3'
      });
      return false;
    }

    if (!this.noticiaForm.contenido?.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Por favor ingrese el contenido de la noticia.',
        confirmButtonColor: '#2196F3'
      });
      return false;
    }

    if (!this.noticiaForm.fecha_publicacion) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Por favor seleccione la fecha de publicación.',
        confirmButtonColor: '#2196F3'
      });
      return false;
    }

    if (!this.noticiaForm.fecha_caducidad) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Por favor seleccione la fecha de caducidad.',
        confirmButtonColor: '#2196F3'
      });
      return false;
    }

    // Validar que la fecha de caducidad sea posterior a la de publicación
    const fechaPub = new Date(this.noticiaForm.fecha_publicacion);
    const fechaCad = new Date(this.noticiaForm.fecha_caducidad);

    if (fechaCad <= fechaPub) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas inválidas',
        text: 'La fecha de caducidad debe ser posterior a la fecha de publicación.',
        confirmButtonColor: '#2196F3'
      });
      return false;
    }

    return true;
  }

  async guardarNoticia() {
    if (!this.validarFormulario()) {
      return;
    }

    this.guardando = true;
    
    try {
      const formData = new FormData();

      // Agregar todos los campos del formulario
      Object.keys(this.noticiaForm).forEach(key => {
        if (this.noticiaForm[key] !== null && this.noticiaForm[key] !== '' && key !== 'imagen_url' && key !== 'video_url') {
          formData.append(key, this.noticiaForm[key]);
        }
      });

      // Determinar el mensaje de carga
      if (this.imagenFile && this.videoFile) {
        this.mensajeCarga = 'Subiendo imagen y video...';
      } else if (this.imagenFile) {
        this.mensajeCarga = 'Subiendo imagen...';
      } else if (this.videoFile) {
        this.mensajeCarga = 'Subiendo video...';
      } else {
        this.mensajeCarga = 'Guardando noticia...';
      }

      // Agregar archivos si existen
      if (this.imagenFile) {
        formData.append('imagen', this.imagenFile);
      }

      if (this.videoFile) {
        formData.append('video', this.videoFile);
      }

      // Crear o actualizar
      if (this.noticiaForm.id_noticia) {
        await firstValueFrom(
          this.newsService.update(this.noticiaForm.id_noticia, formData)
        );
        
        Swal.fire({
          icon: 'success',
          title: 'Actualizada',
          text: 'Noticia actualizada correctamente.',
          confirmButtonColor: '#2196F3',
          timer: 2000
        });
      } else {
        await firstValueFrom(this.newsService.create(formData));
        
        Swal.fire({
          icon: 'success',
          title: 'Creada',
          text: 'Noticia creada correctamente.',
          confirmButtonColor: '#2196F3',
          timer: 2000
        });
      }

      this.editando = false;
      this.limpiarFormulario();
      await this.cargarNoticias();

    } catch (error) {
      console.error('Error al guardar noticia:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar la noticia. Por favor intente nuevamente.',
        confirmButtonColor: '#2196F3'
      });
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
          
          Swal.fire({
            icon: 'success',
            title: 'Eliminada',
            text: 'La noticia ha sido eliminada.',
            confirmButtonColor: '#2196F3',
            timer: 2000
          });
          
          await this.cargarNoticias();
        } catch (error) {
          console.error('Error al eliminar noticia:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo eliminar la noticia.',
            confirmButtonColor: '#2196F3'
          });
        }
      }
    });
  }

  cancelar() {
    this.editando = false;
    this.limpiarFormulario();
  }

  /**
   * Convierte una fecha de formato ISO o timestamp a formato datetime-local
   */
  convertirFechaADatetimeLocal(fecha: string | Date): string {
    const fechaObj = new Date(fecha);
    
    // Ajustar a la zona horaria local
    const offset = fechaObj.getTimezoneOffset();
    const fechaLocal = new Date(fechaObj.getTime() - (offset * 60 * 1000));
    
    // Convertir a formato datetime-local (YYYY-MM-DDTHH:mm)
    return fechaLocal.toISOString().slice(0, 16);
  }
}