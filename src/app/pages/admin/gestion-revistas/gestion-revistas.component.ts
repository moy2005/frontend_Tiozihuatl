import { Component, OnInit, ViewEncapsulation} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MagazinesService } from '../../../api/services/magazines.service';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

/* ===============================
   INTERFACES
================================ */

interface Magazine {
  id_revista?: number;
  titulo: string;
  descripcion?: string;
  precio: number;
  stock: number;
  estado?: string;
  portada_url?: string;
  descuento_activo?: boolean;
}

interface AuditoriaCompra {
  id_auditoria: number;
  usuario: string;
  accion: string;
  descripcion: string;
  ip_address: string;
  fecha: string;
}

@Component({
  selector: 'app-gestion-revistas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './gestion-revistas.component.html',
  styleUrls: ['./gestion-revistas.component.css'],
   encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionRevistasComponent implements OnInit {

  /* ===============================
     CONTROL DE VISTA (TABS)
  =============================== */

  vista: 'revistas' | 'auditoria' = 'revistas';  // 🔥 ESTO FALTABA

  /* ===============================
     REVISTAS
  =============================== */

  magazines: Magazine[] = [];
  loading = false;

  showModal = false;
  saving = false;

  selectedFile?: File;
  previewUrl: string | null = null;

  selectedPortada?: File;
  portadaPreviewUrl: string | null = null;

  form: Magazine = {
    titulo: '',
    descripcion: '',
    precio: 0,
    stock: 0
  };

  /* ===============================
     AUDITORÍA
  =============================== */

  auditoria: AuditoriaCompra[] = [];
  cargandoAuditoria = false;

  filtros = {
    usuario: '',
    fecha_inicio: '',
    fecha_fin: ''
  };

  constructor(private magazinesService: MagazinesService) {}

  ngOnInit(): void {
    this.loadMagazines();
  }

  /* ===============================
     CAMBIAR VISTA
  =============================== */

  cambiarVista(tipo: 'revistas' | 'auditoria'): void {
    this.vista = tipo;

    if (tipo === 'auditoria') {
      this.cargarAuditoria();
    }
  }

  /* ===============================
     REVISTAS
  =============================== */

  loadMagazines(): void {
    this.loading = true;

    this.magazinesService.getAll().subscribe({
      next: (data) => {
        this.magazines = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando revistas:', err);
        this.loading = false;
      }
    });
  }

  trackById(index: number, item: Magazine): number | undefined {
    return item.id_revista;
  }

  openModal(): void {
    this.resetForm();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.form = {
      titulo: '',
      descripcion: '',
      precio: 0,
      stock: 0
    };
    this.selectedFile = undefined;
    this.previewUrl = null;
  }
  toggleMagazine(id: number) {
  this.magazinesService.toggleStatus(id).subscribe(() => {
    this.loadMagazines(); // recarga lista
  });
}

  editMagazine(mag: Magazine): void {
    this.form = { ...mag };
    this.showModal = true;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF');
      return;
    }

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onPortadaSelected(event: any): void {

  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Solo imágenes permitidas para portada');
    return;
  }

  this.selectedPortada = file;

  const reader = new FileReader();
  reader.onload = () => {
    this.portadaPreviewUrl = reader.result as string;
  };

  reader.readAsDataURL(file);
}

  saveMagazine(): void {

    if (!this.form.titulo || this.form.precio == null || this.form.stock == null) {
      alert('Título, precio y stock son obligatorios');
      return;
    }

    // 🔥 VALIDACIÓN NUEVA
    if (!this.selectedFile && !this.form.id_revista) {
      alert("Debes seleccionar un archivo PDF");
      return;
    }

    this.saving = true;

    const formData = new FormData();
    formData.append('titulo', this.form.titulo);
    formData.append('descripcion', this.form.descripcion || '');
    formData.append('precio', String(this.form.precio));
    formData.append('stock', String(this.form.stock));

    if (this.selectedFile) {
      formData.append('pdf', this.selectedFile);
    }
    const request = this.form.id_revista
      ? this.magazinesService.update(this.form.id_revista, formData)
      : this.magazinesService.create(formData);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.loadMagazines();
      },
      error: (err) => {
        this.saving = false;
        console.error('Error al guardar revista:', err);
        alert(err?.error?.error || 'Error al guardar la revista');
      }
    });
  }


  /* ===============================
     AUDITORÍA
  =============================== */

  cargarAuditoria(): void {

    this.cargandoAuditoria = true;

    this.magazinesService.getAuditoria(this.filtros)
      .subscribe({
        next: (data) => {
          this.auditoria = data;
          this.cargandoAuditoria = false;
        },
        error: (err) => {
          console.error('Error cargando auditoría:', err);
          this.cargandoAuditoria = false;
        }
      });
  }

  aplicarFiltros(): void {
    this.cargarAuditoria();
  }

  limpiarFiltros(): void {
    this.filtros = {
      usuario: '',
      fecha_inicio: '',
      fecha_fin: ''
    };
    this.cargarAuditoria();
  }
}
