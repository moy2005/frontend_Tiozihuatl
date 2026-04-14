import { Component, OnInit, HostListener, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MaterialesService } from '../../api/services/materiales.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-materiales-doc',
  templateUrl: './materiales-doc.component.html',
  styleUrls: ['./materiales-doc.component.css'],
  standalone: true,
  imports: [FormsModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MaterialesDocComponent implements OnInit {

  materiales: any[] = [];
  materias:   any[] = [];
  semestres:  any[] = [];

  filtrosExpandidos = false;
  mostrarModal      = false;
  editMode          = false;
  editId: number | null = null;
  loading  = true;
  total    = 0;  

  openMenuId: number | null = null;
  archivoActualNombre = '';

  form: any = {
    titulo:      '',
    descripcion: '',
    visibilidad: 'PUBLICO',
    materias:    [],
    semestres:   []
  };

  filters: any = {
    search:   '',
    materia:  '',
    semestre: '',
    tipo:     '',
    page:     1,
    limit:    6
  };

  file: File | null = null;

  constructor(private service: MaterialesService) {}

  ngOnInit() {
    this.load();
    this.loadCatalogos();
  }

  @HostListener('document:click')
  onDocClick() { this.openMenuId = null; }

  load() {
    this.loading = true;
    const params = { ...this.filters, order: 'desc' };
    this.service.getMine(params).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.materiales = res;
          this.total      = res.length; 
        } else {
          this.materiales = res.data      ?? res.materiales ?? res.items ?? [];
          this.total      = res.total     ?? res.count      ?? this.materiales.length;
        }
        this.materiales.sort((a: any, b: any) => {
          const da = new Date(b.created_at ?? b.fecha_creacion ?? 0).getTime();
          const db = new Date(a.created_at ?? a.fecha_creacion ?? 0).getTime();
          return da - db;
        });
        this.loading = false;
      },
      error: () => { this.materiales = []; this.total = 0; this.loading = false; }
    });
  }

  loadCatalogos() {
    this.service.getMaterias().subscribe((res: any)  => this.materias  = res);
    this.service.getSemestres().subscribe((res: any) => this.semestres = res);
  }

  onSearch() { this.filters.page = 1; this.load(); }

  clearFilters() {
    this.filters = { search: '', materia: '', semestre: '', tipo: '', page: 1, limit: 6 };
    this.load();
  }

  nextPage() { this.filters.page++; this.load(); }
  prevPage() { if (this.filters.page > 1) { this.filters.page--; this.load(); } }

  get hayMasPaginas(): boolean {
    return this.materiales.length >= this.filters.limit;
  }

  get totalPaginas(): number {
    return Math.ceil(this.total / this.filters.limit) || 1;
  }

  onFile(e: any) { this.file = e.target.files[0] ?? null; }

  get fileSize(): string {
    if (!this.file) return '';
    const kb = this.file.size / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  }

  toggleMenu(event: Event, id: number) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  submit() {
    if (!this.form.titulo?.trim()) {
      Swal.fire('Campo requerido', 'El título es obligatorio', 'warning'); return;
    }
    if (!this.editMode && !this.file) {
      Swal.fire('Archivo requerido', 'Debes seleccionar un archivo', 'warning'); return;
    }

    const fd = new FormData();
    fd.append('titulo',      this.form.titulo);
    fd.append('descripcion', this.form.descripcion);
    fd.append('visibilidad', this.form.visibilidad);
    fd.append('materias',    JSON.stringify(this.form.materias));
    fd.append('semestres',   JSON.stringify(this.form.semestres));
    if (this.file) fd.append('file', this.file);

    if (this.editMode && this.editId) {
      this.service.update(this.editId, fd).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Material actualizado', timer: 1500, showConfirmButton: false });
          this.load(); this.reset(); this.mostrarModal = false;
        },
        error: (err: any) => Swal.fire('Error', err?.error?.error || 'No se pudo actualizar', 'error')
      });
    } else {
      this.service.create(fd).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Material subido', timer: 1500, showConfirmButton: false });
          this.load(); this.reset(); this.mostrarModal = false;
        },
        error: (err: any) => Swal.fire('Error', err?.error?.error || 'Error al subir material', 'error')
      });
    }
  }

  delete(id: number) {
    this.openMenuId = null;
    Swal.fire({
      title: '¿Eliminar material?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#EF4444'
    }).then(r => {
      if (r.isConfirmed) {
        this.service.delete(id).subscribe({
          next: () => {
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1400, showConfirmButton: false });
            this.load();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  editar(material: any) {
    this.openMenuId = null;
    this.service.getById(material.id_material).subscribe((res: any) => {
      this.mostrarModal = true;
      this.editMode     = true;
      this.editId       = material.id_material;
      this.archivoActualNombre = this.shortFileName(res);   // ← NUEVO
      this.form = {
        titulo:      res.titulo,
        descripcion: res.descripcion,
        visibilidad: res.visibilidad,
        materias:    res.materias  ? res.materias.split(',').map((x: string) => Number(x))  : [],
        semestres:   res.semestres ? res.semestres.split(',').map((x: string) => Number(x)) : []
      };
    });
  }

  reset() {
    this.form = { titulo: '', descripcion: '', visibilidad: 'PUBLICO', materias: [], semestres: [] };
    this.file                = null;
    this.editMode            = false;
    this.editId              = null;
    this.archivoActualNombre = ''; 
  }

  toggleMateria(id: number) {
    this.form.materias = this.form.materias.includes(id)
      ? this.form.materias.filter((m: number) => m !== id)
      : [...this.form.materias, id];
  }

  toggleSemestre(id: number) {
    this.form.semestres = this.form.semestres.includes(id)
      ? this.form.semestres.filter((s: number) => s !== id)
      : [...this.form.semestres, id];
  }

  tipoIcon(tipo: string): string {
    const map: Record<string, string> = {
      PDF:    'document-text-outline',
      WORD:   'document-outline',
      EXCEL:  'grid-outline',
      PPT:    'easel-outline',
      IMAGEN: 'image-outline',
      VIDEO:  'videocam-outline',
      ZIP:    'archive-outline'
    };
    return map[tipo] ?? 'attach-outline';
  }

  tipoClass(tipo: string): string {
    const map: Record<string, string> = {
      PDF:    'badge-pdf',
      WORD:   'badge-word',
      EXCEL:  'badge-excel',
      PPT:    'badge-ppt',
      IMAGEN: 'badge-img',
      VIDEO:  'badge-video',
      ZIP:    'badge-zip'
    };
    return map[tipo] ?? 'badge-otro';
  }


  shortFileName(material: any): string {
    if (material.nombre_archivo)  return material.nombre_archivo;
    if (material.original_name)   return material.original_name;
    if (material.filename)        return material.filename;
    if (material.public_id) {
      const parts = material.public_id.split('/');
      const raw   = parts[parts.length - 1];       
      const extMap: Record<string, string> = {
        PDF: '.pdf', WORD: '.docx', EXCEL: '.xlsx',
        PPT: '.pptx', IMAGEN: '.jpg', VIDEO: '.mp4', ZIP: '.zip'
      };
      const ext = extMap[material.tipo] ?? '';
      return raw + ext;
    }
    return material.titulo ?? '—';
  }

  visibilidadIcon(vis: string): string {
    return vis === 'PUBLICO' ? 'globe-outline' : 'lock-closed-outline';
  }
}