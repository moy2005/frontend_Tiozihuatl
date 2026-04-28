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
  
  materialEditando: any = null;
  archivoActualNombre = '';
  paginaActual    = 1;
  itemsPorPagina  = 15;
  totalPaginas    = 0;
  Math            = Math;

  cargando = false;

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
    setTimeout(() => {
        this.load();
        this.loadCatalogos();
    }, 300);
    }

   load() {
    this.cargando = true;
    const f = { ...this.filters };
    delete f.page;
    delete f.limit;
    this.service.getAllAdmin(f).subscribe((res: any) => {
      this.materiales = res;
      this.paginaActual = 1;
      this.calcularTotalPaginas();
      this.cargando = false;
    });
  }

  loadCatalogos() {
    this.service.getMaterias().subscribe((res: any) => this.materias = res);
    this.service.getSemestres().subscribe((res: any) => this.semestres = res);
  }

  onSearch() {
    this.paginaActual = 1;
    this.load();
  }

  clearFilters() {
    this.filters = { search: '', materia: '', semestre: '', tipo: '', page: 1, limit: 10 };
    this.paginaActual = 1;
    this.load();
  }

    get materialesPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.materiales.slice(inicio, inicio + this.itemsPorPagina);
  }

    calcularTotalPaginas() {
      this.totalPaginas = Math.ceil(this.materiales.length / this.itemsPorPagina);
      if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) {
        this.paginaActual = this.totalPaginas;
      }
    }

    get paginas(): (number | string)[] {
      this.calcularTotalPaginas();
      const total  = this.totalPaginas;
      const actual = this.paginaActual;
      const delta  = 2;
      const rango: number[] = [];
      const rangoConPuntos: (number | string)[] = [];

      for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= actual - delta && i <= actual + delta)) {
          rango.push(i);
        }
      }

      let previo: number | null = null;
      for (const i of rango) {
        if (previo && i - previo !== 1) rangoConPuntos.push('...');
        rangoConPuntos.push(i);
        previo = i;
      }
      return rangoConPuntos;
    }

    irAPagina(pagina: number | string) {
      if (typeof pagina === 'number') this.paginaActual = pagina;
    }

    paginaAnterior() {
      if (this.paginaActual > 1) this.paginaActual--;
    }

    paginaSiguiente() {
      if (this.paginaActual < this.totalPaginas) this.paginaActual++;
    }

    cambiarItemsPorPagina() {
      this.paginaActual = 1;
      this.calcularTotalPaginas();
    }

  onFile(e: any) { this.file = e.target.files[0]; }

    submit() {
    if (!this.form.titulo) {
        alert('El título es obligatorio');
        return;
    }

    const formData = new FormData();

    formData.append('titulo', this.form.titulo);
    formData.append('descripcion', this.form.descripcion || '');
    formData.append('visibilidad', this.form.visibilidad);

    formData.append('materias', JSON.stringify(this.form.materias));
    formData.append('semestres', JSON.stringify(this.form.semestres));

    // 🔥 SOLO agregar archivo si existe
    if (this.file) {
        formData.append('file', this.file);
    }

    // 🔥 UPDATE vs CREATE
        if (this.editMode && this.editId) {
        this.service.updateAdmin(this.editId, formData).subscribe({
            next: () => {
            Swal.fire({ icon: 'success', title: 'Material actualizado', timer: 1500, showConfirmButton: false });
            this.mostrarModal = false;
            this.reset();
            this.load();
            },
            error: (err: any) => {
            console.error('Error update:', err);
            Swal.fire('Error', err?.error?.error || 'No se pudo actualizar', 'error');
            }
        });

    } else {

        this.service.create(formData).subscribe({
        next: () => {
            console.log('Material creado');
            this.mostrarModal = false;
            this.reset();
            this.load();
        },
        error: (err) => {
            console.error('Error al crear', err);
        }
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
        this.service.deleteAdmin(id).subscribe(() => {
          Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
          this.load();
        });
      }
    });
  }

    editar(m: any) {
    this.service.getByIdAdmin(m.id_material).subscribe((res: any) => {
        this.mostrarModal = true;
        this.editMode = true;
        this.editId = m.id_material;
        this.materialEditando = m;

        // ✅ Extraer nombre del archivo desde public_id
        const extMap: Record<string, string> = {
        PDF: '.pdf', WORD: '.docx', EXCEL: '.xlsx',
        PPT: '.pptx', IMAGEN: '.jpg', VIDEO: '.mp4'
        };
        const partes = (res.public_id || '').split('/');
        this.archivoActualNombre = partes[partes.length - 1] || res.titulo;


        this.form = {
        titulo:      res.titulo,
        descripcion: res.descripcion,
        visibilidad: res.visibilidad,
        materias:  res.materias  ? res.materias.split(',').map((x: string) => Number(x.trim()))  : [],
        semestres: res.semestres ? res.semestres.split(',').map((x: string) => Number(x.trim())) : []
        };

        this.file = null;
    });
    }

    reset() {
    this.form = { titulo: '', descripcion: '', visibilidad: 'PUBLICO', materias: [], semestres: [] };
    this.file = null;
    this.editMode = false;
    this.editId = null;
    this.materialEditando = null;
    this.archivoActualNombre = ''; // ✅
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
        this.service.changeStatusAdmin(material.id_material, material.activo ? 0 : 1).subscribe(() => {
          Swal.fire({ icon: 'success', title: 'Estado actualizado', timer: 1200, showConfirmButton: false });
          this.load();
        });
      }
    });
  }
}
