import { Component, OnInit, ViewEncapsulation,CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAboutService } from '../../../api/services/admin-about.service';

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
  cargando = false;
  guardando = false;
  mostrarModal = false;
  editando = false;

  aboutForm: any = {
    id_about: null,
    type: 'MISION',
    title: '',
    content: '',
    status: 'Activo'
  };

  constructor(private aboutService: AdminAboutService) {}

  ngOnInit() {
    this.cargarContenido();
  }

  cargarContenido() {
    this.cargando = true;
    this.aboutService.getAll().subscribe({
      next: (data) => {
        this.abouts = data;
        this.cargando = false;
      },
      error: () => this.cargando = false
    });
  }

  nuevoAbout() {
    this.editando = false;
    this.aboutForm = {
      id_about: null,
      type: 'MISION',
      title: '',
      content: '',
      status: 'Activo'
    };
    this.mostrarModal = true;
  }

  editarAbout(item: any) {
    this.editando = true;
    this.aboutForm = { ...item };
    this.mostrarModal = true;
  }

  cancelar() {
    this.mostrarModal = false;
    this.guardando = false;
  }

  guardarAbout() {
    if (!this.aboutForm.title.trim() || !this.aboutForm.content.trim()) return;

    this.guardando = true;

    const request = this.aboutForm.id_about
      ? this.aboutService.update(this.aboutForm.id_about, this.aboutForm)
      : this.aboutService.create(this.aboutForm);

    request.subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarModal = false;
        this.cargarContenido();
      },
      error: () => this.guardando = false
    });
  }

  eliminarAbout(id: number) {
    if (!confirm('¿Deseas desactivar este contenido?')) return;

    this.aboutService.delete(id).subscribe(() => {
      this.cargarContenido();
    });
  }
}
