import { Component, OnInit, ViewEncapsulation, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAboutService } from '../../../api/services/admin-about.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestion-about',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-about.html',
  styleUrls: ['./gestion-about.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionAboutComponent implements OnInit {

  abouts: any[] = [];
  cargando  = false;
  guardando = false;
  mostrarModal = false;
  editando  = false;

  aboutForm: any = {
    id_about: null,
    type: 'MISION',
    title: '',
    content: '',
    status: 'Activo'
  };

  constructor(private aboutService: AdminAboutService) {}

  ngOnInit() { this.cargarContenido(); }

  cargarContenido() {
    this.cargando = true;
    this.aboutService.getAll().subscribe({
      next: (data) => { this.abouts = data; this.cargando = false; },
      error: () => {
        this.cargando = false;
        Swal.fire('Error', 'No se pudo cargar el contenido.', 'error');
      }
    });
  }

  nuevoAbout() {
    this.editando = false;
    this.aboutForm = { id_about: null, type: 'MISION', title: '', content: '', status: 'Activo' };
    this.mostrarModal = true;
  }

  editarAbout(item: any) {
    this.editando = true;
    this.aboutForm = { ...item };

    // ✅ Alerta al abrir edición
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: `Editando: ${item.title}`,
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });

    this.mostrarModal = true;
  }

  cancelar() {
    this.mostrarModal = false;
    this.guardando = false;
  }

  guardarAbout() {
    if (!this.aboutForm.title.trim() || !this.aboutForm.content.trim()) {
      Swal.fire('Campos incompletos', 'El título y el contenido son obligatorios.', 'warning');
      return;
    }

    const tipoLabel = this.aboutForm.type === 'MISION'  ? 'Misión'  :
                      this.aboutForm.type === 'VISION'  ? 'Visión'  : 'Valor';

    Swal.fire({
      title: this.editando ? '¿Guardar cambios?' : `¿Crear ${tipoLabel}?`,
      text: this.editando
        ? `Se actualizará "${this.aboutForm.title}".`
        : `Se creará un nuevo contenido de tipo ${tipoLabel}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#03A9F4',
      cancelButtonColor: '#6B7280',
      confirmButtonText: this.editando ? 'Sí, guardar' : 'Sí, crear',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.guardando = true;

      const request = this.aboutForm.id_about
        ? this.aboutService.update(this.aboutForm.id_about, this.aboutForm)
        : this.aboutService.create(this.aboutForm);

      request.subscribe({
        next: () => {
          this.guardando = false;
          this.mostrarModal = false;
          this.cargarContenido();
          Swal.fire({
            title: '¡Éxito!',
            text: this.editando
              ? 'Contenido actualizado correctamente.'
              : `${tipoLabel} creado correctamente.`,
            icon: 'success',
            confirmButtonColor: '#03A9F4',
            timer: 2500,
            timerProgressBar: true
          });
        },
        error: () => {
          this.guardando = false;
          Swal.fire('Error', 'No se pudo guardar el contenido.', 'error');
        }
      });
    });
  }

  eliminarAbout(id: number) {
    const item = this.abouts.find(a => a.id_about === id);

    Swal.fire({
      title: '¿Desactivar contenido?',
      text: item ? `"${item.title}" pasará a estado inactivo.` : 'Este contenido será desactivado.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E53E3E',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.aboutService.delete(id).subscribe({
        next: () => {
          this.cargarContenido();
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Contenido desactivado.',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
          });
        },
        error: () => {
          Swal.fire('Error', 'No se pudo desactivar el contenido.', 'error');
        }
      });
    });
  }
}
