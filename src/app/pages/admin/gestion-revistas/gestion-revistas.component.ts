import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MagazinesService } from '../../../api/services/magazines.service';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import * as XLSXStyle from 'xlsx-js-style';
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

  vista: 'revistas' | 'auditoria' = 'revistas';

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
     FILTROS REVISTAS
  =============================== */

  filtrosExpandidos = false;

  filtrosRevistas = {
    estado: '',
    descuento: '',
    titulo: ''
  };

  revistasFiltradas: Magazine[] = [];

  get filtrosActivos(): boolean {
    return !!(
      this.filtrosRevistas.estado ||
      this.filtrosRevistas.descuento ||
      this.filtrosRevistas.titulo
    );
  }

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
        this.aplicarFiltrosRevistas();
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
    this.form = { titulo: '', descripcion: '', precio: 0, stock: 0 };
    this.selectedFile = undefined;
    this.previewUrl = null;
  }

  toggleMagazine(id: number): void {
    this.magazinesService.toggleStatus(id).subscribe(() => {
      this.loadMagazines();
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
    reader.onload = () => { this.previewUrl = reader.result as string; };
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
    reader.onload = () => { this.portadaPreviewUrl = reader.result as string; };
    reader.readAsDataURL(file);
  }

  saveMagazine(): void {
    if (!this.form.titulo || this.form.precio == null || this.form.stock == null) {
      alert('Título, precio y stock son obligatorios');
      return;
    }
    if (!this.selectedFile && !this.form.id_revista) {
      alert('Debes seleccionar un archivo PDF');
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
     EXPORTAR CSV
  =============================== */

    exportarExcel(): void {
      if (this.revistasFiltradas.length === 0) return;

      const wb = XLSXStyle.utils.book_new();

      // ── Encabezados
      const headers = ['Título', 'Descripción', 'Precio', 'Estado', 'Descuento'];

      // ── Filas de datos
      const dataRows = this.revistasFiltradas.map(mag => [
        mag.titulo,
        mag.descripcion || '',
        `$${mag.precio}`,
        mag.estado || '',
        mag.descuento_activo ? 'Sí' : 'No'
      ]);

      // ── Unir todo
      const wsData = [headers, ...dataRows];
      const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

      // ── Estilo encabezado (fila 1) — azul como tu admin
      const headerStyle = {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        fill:      { fgColor: { rgb: '1565C0' } },  // azul oscuro en vez de claro
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top:    { style: 'medium', color: { rgb: '0D47A1' } },
          bottom: { style: 'medium', color: { rgb: '0D47A1' } },
          left:   { style: 'medium', color: { rgb: '0D47A1' } },
          right:  { style: 'medium', color: { rgb: '0D47A1' } },
        }
      };

      headers.forEach((_, colIdx) => {
        const cellRef = XLSXStyle.utils.encode_cell({ r: 0, c: colIdx });
        if (ws[cellRef]) ws[cellRef].s = headerStyle;
      });

      // ── Estilo filas de datos (alternando blanco y azul claro)
      dataRows.forEach((row, rowIdx) => {
        const isEven = rowIdx % 2 === 0;

        row.forEach((_, colIdx) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
          if (!ws[cellRef]) return;

          const value = ws[cellRef].v;
          let fontColor  = '1E293B';
          let fillColor  = isEven ? 'FFFFFF' : 'E3F2FD';
          let fontBold   = false;

          // Columna Título — negrita
          if (colIdx === 0) {
            fontBold = true;
          }

          // Columna Precio — azul oscuro
          if (colIdx === 2) {
            fontColor = '1565C0';
            fontBold  = true;
          }

          // Columna Estado — verde/rojo con fondo suave
          if (colIdx === 3) {
            if (value === 'Activa') {
              fontColor = '16A34A';
              fillColor = isEven ? 'F0FDF4' : 'DCFCE7';
            } else {
              fontColor = 'DC2626';
              fillColor = isEven ? 'FFF1F2' : 'FFE4E6';
            }
          }

          // Columna Descuento — naranja si es Sí
          if (colIdx === 4) {
            if (value === 'Sí') {
              fontColor = 'D97706';
              fontBold  = true;
            }
          }

          ws[cellRef].s = {
            font:      { color: { rgb: fontColor }, sz: 10, bold: fontBold },
            fill:      { fgColor: { rgb: fillColor } },
            alignment: { vertical: 'center', wrapText: colIdx === 1 },
            border: {
              top:    { style: 'thin', color: { rgb: 'BBDEFB' } },
              bottom: { style: 'thin', color: { rgb: 'BBDEFB' } },
              left:   { style: 'thin', color: { rgb: 'BBDEFB' } },
              right:  { style: 'thin', color: { rgb: 'BBDEFB' } },
            }
          };
        });
      });

      // ── Ancho de columnas
      ws['!cols'] = [
        { wch: 38 },  // Título
        { wch: 52 },  // Descripción
        { wch: 12 },  // Precio
        { wch: 12 },  // Estado
        { wch: 12 },  // Descuento
      ];

      // ── Alto de filas (encabezado más alto)
      // Reemplaza la línea de !rows por:
      const rowHeights = [{ hpt: 22 }]; // encabezado
      dataRows.forEach(() => rowHeights.push({ hpt: 18 }));
      ws['!rows'] = rowHeights;

      XLSXStyle.utils.book_append_sheet(wb, ws, 'Revistas');

      const fecha = new Date().toISOString().slice(0, 10);
      const sufijo = this.filtrosRevistas.estado
        ? `_${this.filtrosRevistas.estado.toLowerCase()}` : '';

      XLSXStyle.writeFile(wb, `revistas${sufijo}_${fecha}.xlsx`);
    }
  /* ===============================
     FILTROS REVISTAS
  =============================== */

  toggleFiltros(): void {
    this.filtrosExpandidos = !this.filtrosExpandidos;
  }

  aplicarFiltrosRevistas(): void {
    let resultado = [...this.magazines];

    if (this.filtrosRevistas.estado) {
      resultado = resultado.filter(m => m.estado === this.filtrosRevistas.estado);
    }

    if (this.filtrosRevistas.descuento === 'activo') {
      resultado = resultado.filter(m => m.descuento_activo === true);
    } else if (this.filtrosRevistas.descuento === 'inactivo') {
      resultado = resultado.filter(m => !m.descuento_activo);
    }

    if (this.filtrosRevistas.titulo.trim()) {
      const busqueda = this.filtrosRevistas.titulo.toLowerCase().trim();
      resultado = resultado.filter(m =>
        m.titulo.toLowerCase().includes(busqueda)
      );
    }

    this.revistasFiltradas = resultado;
  }

  limpiarFiltrosRevistas(): void {
    this.filtrosRevistas = { estado: '', descuento: '', titulo: '' };
    this.aplicarFiltrosRevistas();
  }

  /* ===============================
     AUDITORÍA
  =============================== */

  cargarAuditoria(): void {
    this.cargandoAuditoria = true;
    this.magazinesService.getAuditoria(this.filtros).subscribe({
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
    this.filtros = { usuario: '', fecha_inicio: '', fecha_fin: '' };
    this.cargarAuditoria();
  }
}
