import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MaterialesService } from '../../../api/services/materiales.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestion-materiales',
  templateUrl: './gestion-materiales.component.html',
  styleUrls: ['./gestion-materiales.component.css'],
  standalone: true,
  imports: [FormsModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GestionMaterialesComponent implements OnInit {

  materiales: any[] = [];
  materias: any[] = [];
  semestres: any[] = [];
  filtrosExpandidos = false;
  mostrarModal = false;
  editMode = false;
  editId: number | null = null;

  form: any = {
    titulo: '',
    descripcion: '',
    visibilidad: 'PUBLICO',
    materias: [],
    semestres: []
  };

  filters: any = {
    search: '',
    materia: '',
    semestre: '',
    tipo: '',
    page: 1,
    limit: 10
  };

  file: File | null = null;

  constructor(private service: MaterialesService) {}

  ngOnInit() {

      // DEBUG temporal
  console.log('accessToken:', localStorage.getItem('accessToken'));
  console.log('token:', localStorage.getItem('token'));
  console.log('refreshToken:', localStorage.getItem('refreshToken'));
    this.load();
    this.loadCatalogos();
  }

    load() {
    this.service.getAllAdmin(this.filters).subscribe((res: any) => {
        this.materiales = res;
    });
    }
  loadCatalogos() {
    this.service.getMaterias().subscribe((res: any) => this.materias = res);
    this.service.getSemestres().subscribe((res: any) => this.semestres = res);
  }

  onSearch() {
    this.filters.page = 1;
    this.load();
  }

  clearFilters() {
    this.filters = { search: '', materia: '', semestre: '', tipo: '', page: 1, limit: 10 };
    this.load();
  }

  nextPage() { this.filters.page++; this.load(); }
  prevPage() { if (this.filters.page > 1) { this.filters.page--; this.load(); } }

  onFile(e: any) { this.file = e.target.files[0]; }

  submit() {
    if (!this.editMode && !this.file) {
      Swal.fire('Error', 'Debes seleccionar un archivo', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('titulo', this.form.titulo);
    fd.append('descripcion', this.form.descripcion);
    fd.append('visibilidad', this.form.visibilidad);
    fd.append('materias', JSON.stringify(this.form.materias));
    fd.append('semestres', JSON.stringify(this.form.semestres));
    if (this.file) fd.append('file', this.file);

    if (this.editMode && this.editId) {
      this.service.update(this.editId, fd).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1500, showConfirmButton: false });
          this.load(); this.reset(); this.mostrarModal = false;
        },
        error: () => Swal.fire('Error', 'No se pudo actualizar', 'error')
      });
    } else {
      this.service.create(fd).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Material subido', timer: 1500, showConfirmButton: false });
          this.load(); this.reset(); this.mostrarModal = false;
        },
        error: () => Swal.fire('Error', 'Error al subir material', 'error')
      });
    }
  }

  delete(id: number) {
    Swal.fire({
      title: '¿Eliminar material?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.service.delete(id).subscribe(() => {
          Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
          this.load();
        });
      }
    });
  }

  editar(material: any) {
    this.service.getById(material.id_material).subscribe((res: any) => {
      this.mostrarModal = true;
      this.editMode = true;
      this.editId = material.id_material;
      this.form = {
        titulo: res.titulo,
        descripcion: res.descripcion,
        visibilidad: res.visibilidad,
        materias: res.materias ? res.materias.split(',').map((m: string) => Number(m)) : [],
        semestres: res.semestres ? res.semestres.split(',').map((s: string) => Number(s)) : []
      };
    });
  }

  reset() {
    this.form = { titulo: '', descripcion: '', visibilidad: 'PUBLICO', materias: [], semestres: [] };
    this.file = null;
    this.editMode = false;
    this.editId = null;
  }

  toggleMateria(id: number) {
    if (this.form.materias.includes(id)) {
      this.form.materias = this.form.materias.filter((m: number) => m !== id);
    } else {
      this.form.materias.push(id);
    }
  }

  toggleSemestre(id: number) {
    if (this.form.semestres.includes(id)) {
      this.form.semestres = this.form.semestres.filter((s: number) => s !== id);
    } else {
      this.form.semestres.push(id);
    }
  }

  toggleEstado(material: any) {
    const accion = material.activo ? 'desactivar' : 'activar';
    Swal.fire({
      title: `¿${accion} material?`,
      text: `El material será ${material.activo ? 'oculto' : 'visible'} para usuarios`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.service.changeStatus(material.id_material, material.activo ? 0 : 1).subscribe(() => {
          Swal.fire({ icon: 'success', title: 'Estado actualizado', timer: 1200, showConfirmButton: false });
          this.load();
        });
      }
    });
  }
}