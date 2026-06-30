import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MagazinesService } from '../../../api/services/magazines.service';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import * as XLSXStyle from 'xlsx-js-style';
import Swal from 'sweetalert2';

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

/* ===============================
   CAMPO EXPORTABLE
================================ */
interface CampoExportable {
  key: keyof Magazine | 'descuento_activo';
  label: string;
  activo: boolean;
  orden: number;
}

@Component({
  selector: 'app-gestion-revistas',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  /* ===============================
     EXPORTACIÓN PERSONALIZADA
  =============================== */
  showExportModal = false;

  camposExportables: CampoExportable[] = [
    { key: 'titulo',          label: 'Título',       activo: true,  orden: 1 },
    { key: 'descripcion',     label: 'Descripción',  activo: true,  orden: 2 },
    { key: 'precio',          label: 'Precio',       activo: true,  orden: 3 },
    { key: 'stock',           label: 'Stock',        activo: false, orden: 4 },
    { key: 'estado',          label: 'Estado',       activo: true,  orden: 5 },
    { key: 'descuento_activo',label: 'Descuento',    activo: true,  orden: 6 },
  ];

  opcionesExport = {
    filtroEstado:   '',   // '' = todas, 'Activa' = solo activas, 'Inactiva' = solo inactivas
    incluirResumen: true,
    nombreHoja:     'Revistas',
    nombreArchivo:  'revistas_exportacion'
  };

  get camposSeleccionados(): number {
    return this.camposExportables.filter(c => c.activo).length;
  }

  get camposOrdenados(): CampoExportable[] {
    return [...this.camposExportables].sort((a, b) => a.orden - b.orden);
  }

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
        this.magazines = data.filter(m => m.estado === 'Activa');
        this.aplicarFiltrosRevistas();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando revistas:', err);
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar las revistas.', 'error');
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

  toggleMagazine(mag: Magazine): void {
    const esActiva    = mag.estado === 'Activa';
    const accion      = esActiva ? 'desactivar' : 'activar';
    const nuevoEstado = esActiva ? 'Inactiva' : 'Activa';

    Swal.fire({
      title: `¿Deseas ${accion} esta revista?`,
      text: `La revista pasará a estado ${nuevoEstado}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: esActiva ? '#E53E3E' : '#16A34A',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.magazinesService.toggleStatus(mag.id_revista!).subscribe({
          next: () => {
            Swal.fire(
              '¡Listo!',
              `La revista ha sido ${nuevoEstado === 'Activa' ? 'activada' : 'desactivada'} correctamente.`,
              'success'
            );
            this.loadMagazines();
          },
          error: (err) => {
            Swal.fire('Error', err?.error?.error || 'No se pudo cambiar el estado.', 'error');
          }
        });
      }
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
      Swal.fire('Archivo inválido', 'Solo se permiten archivos PDF.', 'warning');
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
      Swal.fire('Archivo inválido', 'Solo se permiten imágenes para la portada.', 'warning');
      return;
    }
    this.selectedPortada = file;
    const reader = new FileReader();
    reader.onload = () => { this.portadaPreviewUrl = reader.result as string; };
    reader.readAsDataURL(file);
  }

  saveMagazine(): void {
    if (!this.form.titulo || this.form.precio == null || this.form.stock == null) {
      Swal.fire('Campos incompletos', 'Título, precio y stock son obligatorios.', 'info');
      return;
    }
    if (!this.selectedFile && !this.form.id_revista) {
      Swal.fire('PDF requerido', 'Debes seleccionar un archivo PDF para la revista.', 'info');
      return;
    }

    const isEdit = !!this.form.id_revista;

    Swal.fire({
      title: isEdit ? '¿Guardar cambios?' : '¿Crear revista?',
      text: isEdit
        ? `Se actualizará la revista "${this.form.titulo}".`
        : `Se creará la revista "${this.form.titulo}".`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#03A9F4',
      cancelButtonColor: '#6B7280',
      confirmButtonText: isEdit ? 'Sí, guardar' : 'Sí, crear',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.saving = true;

      const formData = new FormData();
      formData.append('titulo',      this.form.titulo);
      formData.append('descripcion', this.form.descripcion || '');
      formData.append('precio',      String(this.form.precio));
      formData.append('stock',       String(this.form.stock));
      if (this.selectedFile) {
        formData.append('pdf', this.selectedFile);
      }

      const request = isEdit
        ? this.magazinesService.update(this.form.id_revista!, formData)
        : this.magazinesService.create(formData);

      request.subscribe({
        next: () => {
          this.saving = false;
          this.closeModal();
          this.loadMagazines();
          Swal.fire(
            '¡Éxito!',
            isEdit ? 'Revista actualizada correctamente.' : 'Revista creada correctamente.',
            'success'
          );
        },
        error: (err) => {
          this.saving = false;
          Swal.fire('Error', err?.error?.error || 'No se pudo guardar la revista.', 'error');
        }
      });
    });
  }

  /* ===============================
     MODAL DE EXPORTACIÓN
  =============================== */

  openExportModal(): void {
    if (this.revistasFiltradas.length === 0) return;
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  toggleTodosCampos(activar: boolean): void {
    this.camposExportables.forEach(c => c.activo = activar);
  }

  moverCampo(campo: CampoExportable, direccion: 'arriba' | 'abajo'): void {
    const sorted = this.camposOrdenados;
    const idx = sorted.findIndex(c => c.key === campo.key);
    if (direccion === 'arriba' && idx > 0) {
      const temp = sorted[idx].orden;
      sorted[idx].orden = sorted[idx - 1].orden;
      sorted[idx - 1].orden = temp;
    } else if (direccion === 'abajo' && idx < sorted.length - 1) {
      const temp = sorted[idx].orden;
      sorted[idx].orden = sorted[idx + 1].orden;
      sorted[idx + 1].orden = temp;
    }
  }

  /* ===============================
     EXPORTAR EXCEL (PERSONALIZADO)
  =============================== */

  ejecutarExportacion(): void {
    const camposActivos = this.camposOrdenados.filter(c => c.activo);

    if (camposActivos.length === 0) {
      Swal.fire('Sin campos', 'Selecciona al menos un campo para exportar.', 'warning');
      return;
    }

    // Filtrar datos según opciones
    let datos = [...this.revistasFiltradas];
    if (this.opcionesExport.filtroEstado) {
      datos = datos.filter(m => m.estado === this.opcionesExport.filtroEstado);
    }

    if (datos.length === 0) {
      Swal.fire('Sin datos', 'No hay revistas para exportar con los filtros seleccionados.', 'info');
      return;
    }

    const wb = XLSXStyle.utils.book_new();

    // ── Hoja principal ──
    const headers = camposActivos.map(c => c.label);

    const dataRows = datos.map(mag => {
      return camposActivos.map(campo => {
        switch (campo.key) {
          case 'titulo':           return mag.titulo || '';
          case 'descripcion':      return mag.descripcion || '';
          case 'precio':           return `$${mag.precio}`;
          case 'stock':            return mag.stock;
          case 'estado':           return mag.estado || '';
          case 'descuento_activo': return mag.descuento_activo ? 'Sí' : 'No';
          default:                 return '';
        }
      });
    });

    const wsData = [headers, ...dataRows];
    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

    // Estilos cabecera
    const headerStyle = {
      font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
      fill:      { fgColor: { rgb: '1565C0' } },
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

    // Estilos filas de datos
    dataRows.forEach((row, rowIdx) => {
      const isEven = rowIdx % 2 === 0;

      row.forEach((_, colIdx) => {
        const cellRef = XLSXStyle.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
        if (!ws[cellRef]) return;

        const campoKey  = camposActivos[colIdx].key;
        const value     = ws[cellRef].v;
        let fontColor   = '1E293B';
        let fillColor   = isEven ? 'FFFFFF' : 'E3F2FD';
        let fontBold    = false;

        if (campoKey === 'titulo')  { fontBold = true; }
        if (campoKey === 'precio')  { fontColor = '1565C0'; fontBold = true; }
        if (campoKey === 'estado') {
          if (value === 'Activa')  { fontColor = '16A34A'; fillColor = isEven ? 'F0FDF4' : 'DCFCE7'; }
          else                     { fontColor = 'DC2626'; fillColor = isEven ? 'FFF1F2' : 'FFE4E6'; }
        }
        if (campoKey === 'descuento_activo' && value === 'Sí') { fontColor = 'D97706'; fontBold = true; }

        ws[cellRef].s = {
          font:      { color: { rgb: fontColor }, sz: 10, bold: fontBold },
          fill:      { fgColor: { rgb: fillColor } },
          alignment: { vertical: 'center', wrapText: campoKey === 'descripcion' },
          border: {
            top:    { style: 'thin', color: { rgb: 'BBDEFB' } },
            bottom: { style: 'thin', color: { rgb: 'BBDEFB' } },
            left:   { style: 'thin', color: { rgb: 'BBDEFB' } },
            right:  { style: 'thin', color: { rgb: 'BBDEFB' } },
          }
        };
      });
    });

    // Anchos de columna dinámicos
    ws['!cols'] = camposActivos.map(campo => {
      switch (campo.key) {
        case 'titulo':           return { wch: 38 };
        case 'descripcion':      return { wch: 52 };
        case 'precio':           return { wch: 12 };
        case 'stock':            return { wch: 10 };
        case 'estado':           return { wch: 12 };
        case 'descuento_activo': return { wch: 12 };
        default:                 return { wch: 16 };
      }
    });

    const rowHeights = [{ hpt: 22 }];
    dataRows.forEach(() => rowHeights.push({ hpt: 18 }));
    ws['!rows'] = rowHeights;

    XLSXStyle.utils.book_append_sheet(
      wb, ws,
      this.opcionesExport.nombreHoja || 'Revistas'
    );

    // ── Hoja de resumen (opcional) ──
    if (this.opcionesExport.incluirResumen) {
      const totalActivas   = datos.filter(m => m.estado === 'Activa').length;
      const totalInactivas = datos.filter(m => m.estado === 'Inactiva').length;
      const totalConDesc   = datos.filter(m => m.descuento_activo).length;
      const precioPromedio = datos.length
        ? (datos.reduce((s, m) => s + Number(m.precio), 0) / datos.length).toFixed(2)
        : '0.00';
      const precioMax = datos.length
        ? Math.max(...datos.map(m => Number(m.precio)))
        : 0;
      const precioMin = datos.length
        ? Math.min(...datos.map(m => Number(m.precio)))
        : 0;

      const resumenData = [
        ['RESUMEN DE EXPORTACIÓN', ''],
        ['', ''],
        ['Fecha de exportación', new Date().toLocaleDateString('es-MX')],
        ['Total de revistas exportadas', datos.length],
        ['Revistas activas', totalActivas],
        ['Revistas inactivas', totalInactivas],
        ['Con descuento activo', totalConDesc],
        ['', ''],
        ['PRECIOS', ''],
        ['Precio promedio', `$${precioPromedio}`],
        ['Precio máximo', `$${precioMax}`],
        ['Precio mínimo', `$${precioMin}`],
        ['', ''],
        ['Campos exportados', camposActivos.map(c => c.label).join(', ')],
        ['Filtros aplicados', this.opcionesExport.filtroEstado === 'Activa' ? 'Solo revistas activas' : this.opcionesExport.filtroEstado === 'Inactiva' ? 'Solo revistas inactivas' : 'Todas las revistas'],
      ];

      const wsResumen = XLSXStyle.utils.aoa_to_sheet(resumenData);

      // Estilo título resumen
      const tituloCell = XLSXStyle.utils.encode_cell({ r: 0, c: 0 });
      if (wsResumen[tituloCell]) {
        wsResumen[tituloCell].s = {
          font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
          fill:      { fgColor: { rgb: '1565C0' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }

      // Estilo subtítulos de sección
      [[8, 0], [8, 1]].forEach(([r, c]) => {
        const ref = XLSXStyle.utils.encode_cell({ r, c });
        if (wsResumen[ref] && wsResumen[ref].v) {
          wsResumen[ref].s = {
            font: { bold: true, color: { rgb: '1565C0' }, sz: 11 },
            fill: { fgColor: { rgb: 'E3F2FD' } },
          };
        }
      });

      // Estilo filas de datos del resumen
      for (let r = 2; r < resumenData.length; r++) {
        for (let c = 0; c < 2; c++) {
          const ref = XLSXStyle.utils.encode_cell({ r, c });
          if (!wsResumen[ref]) continue;
          wsResumen[ref].s = {
            font:  { sz: 10, bold: c === 0, color: { rgb: c === 0 ? '334155' : '1E293B' } },
            fill:  { fgColor: { rgb: r % 2 === 0 ? 'FFFFFF' : 'F0F8FF' } },
            border: {
              top:    { style: 'thin', color: { rgb: 'BBDEFB' } },
              bottom: { style: 'thin', color: { rgb: 'BBDEFB' } },
              left:   { style: 'thin', color: { rgb: 'BBDEFB' } },
              right:  { style: 'thin', color: { rgb: 'BBDEFB' } },
            }
          };
        }
      }

      wsResumen['!cols'] = [{ wch: 32 }, { wch: 48 }];
      XLSXStyle.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    }

    // Nombre de archivo
    const fecha   = new Date().toISOString().slice(0, 10);
    const nombre  = (this.opcionesExport.nombreArchivo || 'revistas_exportacion').trim();
    XLSXStyle.writeFile(wb, `${nombre}_${fecha}.xlsx`);

    this.closeExportModal();

    Swal.fire({
      title: '¡Exportación exitosa!',
      html: `Se exportaron <strong>${datos.length}</strong> revistas con <strong>${camposActivos.length}</strong> campos.`,
      icon: 'success',
      confirmButtonColor: '#03A9F4',
      timer: 3000,
      timerProgressBar: true
    });
  }

  /* ── Exportación rápida (sin modal, comportamiento anterior) ── */
  exportarExcel(): void {
    if (this.revistasFiltradas.length === 0) return;
    this.openExportModal();
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
      resultado = resultado.filter(m => m.titulo.toLowerCase().includes(busqueda));
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
        Swal.fire('Error', 'No se pudo cargar la auditoría.', 'error');
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
