import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { EventsService } from '../../../api/services/events.service';

type ModoPublicacion = 'ahora' | 'programada';

interface EventoImagenEditable {
  uid: string;
  source: 'existing' | 'new';
  id_imagen?: number;
  url: string;
  file?: File;
  orden: number;
}

@Component({
  selector: 'app-gestion-eventos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './gestion-eventos.html',
  styleUrls: ['./gestion-eventos.css'],
  encapsulation: ViewEncapsulation.Emulated,
})
export class GestionEventosComponent implements OnInit {
  @ViewChild('imagenesInput') imagenesInput?: ElementRef<HTMLInputElement>;

  eventos: any[] = [];
  cargando = false;
  editando = false;
  guardando = false;
  mostrarDetalles = false;
  eventoSeleccionado: any = null;
  mensajeCarga = 'Guardando evento...';

  filtros = this.crearFiltrosVacios();
  eventoForm = this.crearFormularioVacio();

  imagenesOrdenadas: EventoImagenEditable[] = [];
  draggingImageUid: string | null = null;
  dragOverImageUid: string | null = null;

  constructor(private eventsService: EventsService) {}

  ngOnInit() {
    this.cargarEventos();
  }

  private crearFormularioVacio() {
    return {
      id_evento: null,
      titulo: '',
      descripcion: '',
      tipo: 'PRESENCIAL',
      ubicacion: '',
      enlace: '',
      modo_publicacion: 'ahora' as ModoPublicacion,
      fecha_inicio: '',
      fecha_fin: '',
      destacado: false,
      cancelar_evento: false,
      estado: '',
    };
  }

  private crearFiltrosVacios() {
    return {
      search: '',
      tipo: '',
      estado: '',
      destacado: '',
      vigencia: '',
      fecha_desde: '',
      fecha_hasta: '',
    };
  }

  private generarUid(prefix = 'img') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private parseFechaLocal(fecha: string | null): Date | null {
    if (!fecha) return null;
    const parsed = new Date(String(fecha).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private sumarAnios(fecha: Date, anios: number) {
    const copia = new Date(fecha);
    copia.setFullYear(copia.getFullYear() + anios);
    return copia;
  }

  private obtenerSiguienteHoraDisponible() {
    const fecha = new Date();
    fecha.setHours(fecha.getHours() + 1, 0, 0, 0);
    return fecha;
  }

  private obtenerModoPublicacionInicial(evento: any): ModoPublicacion {
    const fechaInicio = this.parseFechaLocal(evento?.fecha_inicio || null);
    const esFutura = !!fechaInicio && fechaInicio.getTime() > Date.now();
    return evento?.estado === 'Borrador' && esFutura ? 'programada' : 'ahora';
  }

  private obtenerFechaInicioEfectivaFormulario(): Date | null {
    const ahora = new Date();

    if (this.eventoForm.modo_publicacion === 'programada') {
      return this.parseFechaLocal(this.eventoForm.fecha_inicio);
    }

    const fechaActual = this.parseFechaLocal(this.eventoForm.fecha_inicio);

    if (!this.eventoForm.id_evento || !fechaActual) {
      return ahora;
    }

    if (fechaActual > ahora || this.eventoForm.estado === 'Borrador') {
      return ahora;
    }

    return fechaActual;
  }

  private formatearFechaParaApi(fecha: string) {
    const valor = String(fecha || '').trim();
    if (!valor) return '';
    return valor.length === 16 ? valor.replace('T', ' ') + ':00' : valor.replace('T', ' ');
  }

  private obtenerFiltrosApi() {
    const filtros: Record<string, string> = {};

    Object.entries(this.filtros).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        filtros[key] = key.startsWith('fecha_')
          ? this.formatearFechaParaApi(String(value))
          : String(value);
      }
    });

    return filtros;
  }

  private obtenerMensajeError(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse && error.error?.message) {
      return error.error.message;
    }

    return fallback;
  }

  private async archivoABase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
      reader.readAsDataURL(file);
    });
  }

  private normalizarOrdenGaleria() {
    this.imagenesOrdenadas = this.imagenesOrdenadas.map((imagen, index) => ({
      ...imagen,
      orden: index + 1,
    }));
  }

  private obtenerImagenesNuevasEnOrden() {
    return this.imagenesOrdenadas.filter((imagen) => imagen.source === 'new' && imagen.file);
  }

  private actualizarImagenesEnListaLocal(idEvento: number, imagenes: any[]) {
    const evento = this.eventos.find((item) => Number(item.id_evento) === Number(idEvento));

    if (evento) {
      evento.imagenes = [...imagenes];
      evento.total_imagenes = imagenes.length;
      evento.imagen_principal = imagenes[0]?.url || null;
    }

    if (
      this.eventoSeleccionado &&
      Number(this.eventoSeleccionado.id_evento) === Number(idEvento)
    ) {
      this.eventoSeleccionado = {
        ...this.eventoSeleccionado,
        imagenes: [...imagenes],
        total_imagenes: imagenes.length,
        imagen_principal: imagenes[0]?.url || null,
      };
    }
  }

  normalizarBooleano(valor: any) {
    return valor === true || valor === 1 || valor === '1' || valor === 'true';
  }

  puedeCancelarEvento() {
    return !!this.eventoForm.id_evento;
  }

  obtenerClaseEstado(estado: string) {
    return {
      'badge-borrador': estado === 'Borrador',
      'badge-publicado': estado === 'Publicado',
      'badge-finalizado': estado === 'Finalizado',
      'badge-cancelado': estado === 'Cancelado',
    };
  }

  obtenerMensajeProgramacion() {
    if (this.eventoForm.modo_publicacion === 'programada') {
      return 'La fecha de inicio tambien sera la fecha de publicacion. Puedes programarla hasta 1 anio adelante.';
    }

    return 'Al guardar se usara automaticamente la fecha actual como inicio y publicacion.';
  }

  obtenerMinFechaInicioProgramado() {
    const minima = new Date();
    minima.setMinutes(minima.getMinutes() + 1, 0, 0);
    return this.convertirFechaADatetimeLocal(minima);
  }

  obtenerMaxFechaInicioProgramado() {
    return this.convertirFechaADatetimeLocal(this.sumarAnios(new Date(), 1));
  }

  obtenerMaxFechaFin() {
    return this.convertirFechaADatetimeLocal(this.sumarAnios(new Date(), 5));
  }

  async cargarEventos() {
    this.cargando = true;

    try {
      this.eventos = await firstValueFrom(this.eventsService.getAll(this.obtenerFiltrosApi()));
    } catch (error) {
      console.error('Error al cargar eventos:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los eventos.',
        confirmButtonColor: '#2196F3',
      });
    } finally {
      this.cargando = false;
    }
  }

  buscarEventos() {
    this.cargarEventos();
  }

  limpiarFiltros() {
    this.filtros = this.crearFiltrosVacios();
    this.cargarEventos();
  }

  nuevoEvento() {
    this.limpiarFormulario();
    this.editando = true;
  }

  onModoPublicacionChange() {
    if (this.eventoForm.modo_publicacion !== 'programada') {
      this.eventoForm.fecha_inicio = '';
      return;
    }

    const ahora = new Date();
    const limite = this.sumarAnios(ahora, 1);
    const fechaInicio = this.parseFechaLocal(this.eventoForm.fecha_inicio);

    if (!fechaInicio || fechaInicio <= ahora || fechaInicio > limite) {
      this.eventoForm.fecha_inicio = this.convertirFechaADatetimeLocal(
        this.obtenerSiguienteHoraDisponible()
      );
    }
  }

  editarEvento(evento: any) {
    this.limpiarPreviews();

    const modoPublicacion = this.obtenerModoPublicacionInicial(evento);
    const imagenes = [...(evento.imagenes || [])]
      .sort((a, b) => Number(a.orden) - Number(b.orden))
      .map((imagen, index) => ({
        uid: `existing-${imagen.id_imagen}`,
        source: 'existing' as const,
        id_imagen: Number(imagen.id_imagen),
        url: imagen.url,
        orden: index + 1,
      }));

    this.imagenesOrdenadas = imagenes;
    this.eventoForm = {
      ...this.crearFormularioVacio(),
      ...evento,
      modo_publicacion: modoPublicacion,
      fecha_inicio:
        modoPublicacion === 'programada' && evento.fecha_inicio
          ? this.convertirFechaADatetimeLocal(evento.fecha_inicio)
          : '',
      fecha_fin: evento.fecha_fin ? this.convertirFechaADatetimeLocal(evento.fecha_fin) : '',
      destacado: this.normalizarBooleano(evento.destacado),
      cancelar_evento: evento.estado === 'Cancelado',
    };

    this.editando = true;
  }

  verDetalles(evento: any) {
    this.eventoSeleccionado = {
      ...evento,
      destacado: this.normalizarBooleano(evento.destacado),
      imagenes: [...(evento.imagenes || [])].sort(
        (a, b) => Number(a.orden) - Number(b.orden)
      ),
    };
    this.mostrarDetalles = true;
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.eventoSeleccionado = null;
  }

  onTipoChange() {
    if (this.eventoForm.tipo === 'PRESENCIAL') {
      this.eventoForm.enlace = '';
      return;
    }

    this.eventoForm.ubicacion = '';
  }

  abrirSelectorImagenes() {
    this.imagenesInput?.nativeElement.click();
  }

  async onImagenesChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);

    if (!files.length) return;

    if (this.imagenesOrdenadas.length + files.length > 15) {
      await Swal.fire({
        icon: 'warning',
        title: 'Limite excedido',
        text: 'Solo se permiten hasta 15 imagenes por evento.',
        confirmButtonColor: '#2196F3',
      });
      input.value = '';
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        await Swal.fire({
          icon: 'error',
          title: 'Archivo invalido',
          text: 'Solo puedes cargar archivos de imagen.',
          confirmButtonColor: '#2196F3',
        });
        input.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        await Swal.fire({
          icon: 'error',
          title: 'Imagen muy grande',
          text: 'Cada imagen debe pesar como maximo 5MB.',
          confirmButtonColor: '#2196F3',
        });
        input.value = '';
        return;
      }
    }

    try {
      const previews = await Promise.all(files.map((file) => this.archivoABase64(file)));

      files.forEach((file, index) => {
        this.imagenesOrdenadas.push({
          uid: this.generarUid('new'),
          source: 'new',
          url: previews[index],
          file,
          orden: this.imagenesOrdenadas.length + 1,
        });
      });

      this.normalizarOrdenGaleria();
    } catch (error) {
      console.error('Error al preparar imagenes:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron preparar las imagenes seleccionadas.',
        confirmButtonColor: '#2196F3',
      });
    } finally {
      input.value = '';
    }
  }

  async eliminarImagen(imagen: EventoImagenEditable) {
    if (imagen.source === 'new') {
      this.imagenesOrdenadas = this.imagenesOrdenadas.filter((item) => item.uid !== imagen.uid);
      this.normalizarOrdenGaleria();
      return;
    }

    const result = await Swal.fire({
      title: 'Eliminar imagen',
      text: 'La imagen actual se eliminara del evento.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2196F3',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed || !imagen.id_imagen) return;

    try {
      await firstValueFrom(this.eventsService.deleteImagen(Number(imagen.id_imagen)));

      this.imagenesOrdenadas = this.imagenesOrdenadas.filter((item) => item.uid !== imagen.uid);
      this.normalizarOrdenGaleria();

      if (this.eventoForm.id_evento) {
        this.actualizarImagenesEnListaLocal(
          this.eventoForm.id_evento,
          this.imagenesOrdenadas
            .filter((item) => item.source === 'existing')
            .map((item) => ({
              id_imagen: item.id_imagen,
              url: item.url,
              orden: item.orden,
            }))
        );
      }

      await Swal.fire({
        icon: 'success',
        title: 'Imagen eliminada',
        text: 'La imagen fue eliminada correctamente.',
        confirmButtonColor: '#2196F3',
        timer: 1800,
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: this.obtenerMensajeError(error, 'No se pudo eliminar la imagen.'),
        confirmButtonColor: '#2196F3',
      });
    }
  }

  onDragStart(event: DragEvent, uid: string) {
    this.draggingImageUid = uid;
    event.dataTransfer?.setData('text/plain', uid);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, uid: string) {
    event.preventDefault();
    if (this.draggingImageUid !== uid) {
      this.dragOverImageUid = uid;
    }

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragLeave(uid: string) {
    if (this.dragOverImageUid === uid) {
      this.dragOverImageUid = null;
    }
  }

  onDrop(event: DragEvent, uid: string) {
    event.preventDefault();

    if (!this.draggingImageUid || this.draggingImageUid === uid) {
      this.onDragEnd();
      return;
    }

    const fromIndex = this.imagenesOrdenadas.findIndex(
      (imagen) => imagen.uid === this.draggingImageUid
    );
    const toIndex = this.imagenesOrdenadas.findIndex((imagen) => imagen.uid === uid);

    if (fromIndex === -1 || toIndex === -1) {
      this.onDragEnd();
      return;
    }

    const [imagen] = this.imagenesOrdenadas.splice(fromIndex, 1);
    this.imagenesOrdenadas.splice(toIndex, 0, imagen);
    this.normalizarOrdenGaleria();
    this.onDragEnd();
  }

  onDragEnd() {
    this.draggingImageUid = null;
    this.dragOverImageUid = null;
  }

  limpiarPreviews() {
    this.imagenesOrdenadas = [];
    this.draggingImageUid = null;
    this.dragOverImageUid = null;

    if (this.imagenesInput) {
      this.imagenesInput.nativeElement.value = '';
    }
  }

  limpiarFormulario() {
    this.eventoForm = this.crearFormularioVacio();
    this.limpiarPreviews();
  }

  cancelar() {
    this.editando = false;
    this.limpiarFormulario();
  }

  validarFormulario() {
    if (!this.eventoForm.titulo?.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Ingresa el titulo del evento.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    if (!this.eventoForm.descripcion?.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Ingresa la descripcion del evento.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    if (this.eventoForm.modo_publicacion === 'programada') {
      if (!this.eventoForm.fecha_inicio) {
        Swal.fire({
          icon: 'warning',
          title: 'Fecha requerida',
          text: 'Selecciona la fecha de inicio y publicacion.',
          confirmButtonColor: '#2196F3',
        });
        return false;
      }

      const fechaInicio = this.parseFechaLocal(this.eventoForm.fecha_inicio);
      const ahora = new Date();
      const limiteProgramacion = this.sumarAnios(ahora, 1);

      if (!fechaInicio || fechaInicio <= ahora) {
        Swal.fire({
          icon: 'warning',
          title: 'Fecha invalida',
          text: 'La publicacion programada debe ser posterior al momento actual.',
          confirmButtonColor: '#2196F3',
        });
        return false;
      }

      if (fechaInicio > limiteProgramacion) {
        Swal.fire({
          icon: 'warning',
          title: 'Fecha fuera de rango',
          text: 'La fecha programada no puede superar 1 anio hacia adelante.',
          confirmButtonColor: '#2196F3',
        });
        return false;
      }
    }

    if (!this.eventoForm.fecha_fin) {
      Swal.fire({
        icon: 'warning',
        title: 'Fecha requerida',
        text: 'Selecciona la fecha de fin del evento.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    const fechaInicio = this.obtenerFechaInicioEfectivaFormulario();
    const fechaFin = this.parseFechaLocal(this.eventoForm.fecha_fin);
    const limiteFinalizacion = this.sumarAnios(new Date(), 5);

    if (!fechaInicio || !fechaFin) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas invalidas',
        text: 'Revisa las fechas capturadas para el evento.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    if (fechaFin <= fechaInicio) {
      Swal.fire({
        icon: 'warning',
        title: 'Rango invalido',
        text: 'La fecha de fin debe ser posterior al inicio y publicacion.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    if (fechaFin > limiteFinalizacion) {
      Swal.fire({
        icon: 'warning',
        title: 'Fecha fuera de rango',
        text: 'La fecha de fin no puede superar 5 anios hacia adelante.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    if (this.eventoForm.tipo === 'PRESENCIAL' && !this.eventoForm.ubicacion?.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Ingresa la ubicacion del evento presencial.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    if (this.eventoForm.tipo === 'VIRTUAL') {
      if (!this.eventoForm.enlace?.trim()) {
        Swal.fire({
          icon: 'warning',
          title: 'Campo requerido',
          text: 'Ingresa el enlace del evento virtual.',
          confirmButtonColor: '#2196F3',
        });
        return false;
      }

      try {
        new URL(this.eventoForm.enlace);
      } catch {
        Swal.fire({
          icon: 'warning',
          title: 'Enlace invalido',
          text: 'Ingresa una URL valida para el evento virtual.',
          confirmButtonColor: '#2196F3',
        });
        return false;
      }
    }

    if (this.imagenesOrdenadas.length > 15) {
      Swal.fire({
        icon: 'warning',
        title: 'Limite excedido',
        text: 'Solo se permiten hasta 15 imagenes por evento.',
        confirmButtonColor: '#2196F3',
      });
      return false;
    }

    return true;
  }

  async guardarEvento() {
    if (!this.validarFormulario()) return;

    this.guardando = true;
    this.mensajeCarga = this.obtenerImagenesNuevasEnOrden().length
      ? 'Subiendo imagenes y guardando evento...'
      : 'Guardando evento...';

    try {
      const formData = new FormData();

      formData.append('titulo', this.eventoForm.titulo.trim());
      formData.append('descripcion', this.eventoForm.descripcion.trim());
      formData.append('tipo', this.eventoForm.tipo);
      formData.append('modo_publicacion', this.eventoForm.modo_publicacion);
      formData.append('fecha_inicio', this.formatearFechaParaApi(this.eventoForm.fecha_inicio || ''));
      formData.append('fecha_fin', this.formatearFechaParaApi(this.eventoForm.fecha_fin));
      formData.append('destacado', this.eventoForm.destacado ? '1' : '0');
      formData.append('cancelar_evento', this.eventoForm.cancelar_evento ? '1' : '0');

      if (this.eventoForm.tipo === 'PRESENCIAL') {
        formData.append('ubicacion', this.eventoForm.ubicacion.trim());
      }

      if (this.eventoForm.tipo === 'VIRTUAL') {
        formData.append('enlace', this.eventoForm.enlace.trim());
      }

      const ordenImagenes = this.imagenesOrdenadas.map((imagen) =>
        imagen.source === 'existing'
          ? { source: 'existing', id_imagen: imagen.id_imagen }
          : { source: 'new', temp_id: imagen.uid }
      );

      if (ordenImagenes.length) {
        formData.append('orden_imagenes', JSON.stringify(ordenImagenes));
      }

      const nuevasImagenes = this.obtenerImagenesNuevasEnOrden();
      if (nuevasImagenes.length) {
        formData.append(
          'imagenes_temp_ids',
          JSON.stringify(nuevasImagenes.map((imagen) => imagen.uid))
        );

        nuevasImagenes.forEach((imagen) => {
          if (imagen.file) {
            formData.append('imagenes', imagen.file);
          }
        });
      }

      if (this.eventoForm.id_evento) {
        await firstValueFrom(this.eventsService.update(this.eventoForm.id_evento, formData));
        await Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Evento actualizado correctamente.',
          confirmButtonColor: '#2196F3',
          timer: 2000,
        });
      } else {
        await firstValueFrom(this.eventsService.create(formData));
        await Swal.fire({
          icon: 'success',
          title: 'Creado',
          text: 'Evento creado correctamente.',
          confirmButtonColor: '#2196F3',
          timer: 2000,
        });
      }

      this.editando = false;
      this.limpiarFormulario();
      await this.cargarEventos();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: this.obtenerMensajeError(error, 'No se pudo guardar el evento.'),
        confirmButtonColor: '#2196F3',
      });
    } finally {
      this.guardando = false;
    }
  }

  async eliminarEvento(id: number) {
    const result = await Swal.fire({
      title: 'Eliminar evento',
      text: 'Esta accion eliminara el evento y sus imagenes.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2196F3',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) return;

    try {
      await firstValueFrom(this.eventsService.delete(id));
      await Swal.fire({
        icon: 'success',
        title: 'Eliminado',
        text: 'El evento fue eliminado correctamente.',
        confirmButtonColor: '#2196F3',
        timer: 1800,
      });
      await this.cargarEventos();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: this.obtenerMensajeError(error, 'No se pudo eliminar el evento.'),
        confirmButtonColor: '#2196F3',
      });
    }
  }

  async toggleDestacado(evento: any) {
    const nuevoDestacado = !this.normalizarBooleano(evento.destacado);

    try {
      await firstValueFrom(
        this.eventsService.updateDestacado(Number(evento.id_evento), nuevoDestacado)
      );

      await Swal.fire({
        icon: 'success',
        title: nuevoDestacado ? 'Evento destacado' : 'Destacado retirado',
        text: nuevoDestacado
          ? 'El evento ahora aparece como destacado.'
          : 'El evento ya no esta marcado como destacado.',
        confirmButtonColor: '#2196F3',
        timer: 1600,
      });

      await this.cargarEventos();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: this.obtenerMensajeError(error, 'No se pudo actualizar el destacado.'),
        confirmButtonColor: '#2196F3',
      });
    }
  }

  convertirFechaADatetimeLocal(fecha: string | Date | null | undefined): string {
    if (!fecha) return '';

    const fechaObj =
      fecha instanceof Date
        ? new Date(fecha.getTime())
        : new Date(String(fecha).trim().replace(' ', 'T'));

    if (Number.isNaN(fechaObj.getTime())) {
      return '';
    }

    const anio = fechaObj.getFullYear();
    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaObj.getDate()).padStart(2, '0');
    const horas = String(fechaObj.getHours()).padStart(2, '0');
    const minutos = String(fechaObj.getMinutes()).padStart(2, '0');

    return `${anio}-${mes}-${dia}T${horas}:${minutos}`;
  }
}
