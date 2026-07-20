import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';
import { ToastrService } from 'ngx-toastr';
import { utils, writeFile } from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import {
  LatestLoanRow,
  LatestSaleRow,
  RecentActivityRow,
  ReportFilters,
  ReportKpi,
  ReportSnapshot,
  ReportStatus,
  ReportType,
  TopBookRow,
} from '../../../api/models/reports.models';
import { ReportsService } from '../../../api/services/reports.service';

type TableTab = 'loans' | 'books' | 'sales' | 'activity';
type ChartKey = 'loans' | 'books' | 'roles' | 'magazines' | 'activity';

interface KpiView {
  key: keyof ReportSnapshot['kpis'];
  label: string;
  icon: string;
  color: string;
  value: number;
  variation?: number;
  detail: string;
}

interface ExportChart {
  title: string;
  canvas: HTMLCanvasElement;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
  styleUrls: ['./reportes.css'],
  encapsulation: ViewEncapsulation.None,
})
export class ReportesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('loanTrendChart') loanTrendCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topBooksChart') topBooksCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('usersRoleChart') usersRoleCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('magazineSalesChart') magazineSalesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('institutionalActivityChart') institutionalActivityCanvas?: ElementRef<HTMLCanvasElement>;

  readonly today = this.localIsoDate(new Date());
  readonly reportTypes: ReadonlyArray<{ value: ReportType; label: string }> = [
    { value: 'general', label: 'Panorama general' },
    { value: 'usuarios', label: 'Usuarios' },
    { value: 'libros', label: 'Libros' },
    { value: 'prestamos', label: 'Préstamos y devoluciones' },
    { value: 'ventas', label: 'Revistas y ventas' },
    { value: 'eventos', label: 'Actividad institucional' },
  ];
  readonly statuses: ReadonlyArray<{ value: ReportStatus; label: string }> = [
    { value: '', label: 'Todos los estados' },
    { value: 'activo', label: 'Activo / publicado' },
    { value: 'completado', label: 'Completado' },
    { value: 'pendiente', label: 'Pendiente / vencido' },
    { value: 'cancelado', label: 'Cancelado / inactivo' },
  ];
  readonly tableTabs: ReadonlyArray<{ id: TableTab; label: string; icon: string }> = [
    { id: 'loans', label: 'Últimos préstamos', icon: 'ph-book-bookmark' },
    { id: 'books', label: 'Libros solicitados', icon: 'ph-books' },
    { id: 'sales', label: 'Últimas ventas', icon: 'ph-receipt' },
    { id: 'activity', label: 'Actividad reciente', icon: 'ph-activity' },
  ];

  filters: ReportFilters = this.defaultFilters();
  appliedFilters: ReportFilters = { ...this.filters };
  snapshot: ReportSnapshot | null = null;
  kpis: KpiView[] = [];
  loading = true;
  exporting = false;
  errorMessage = '';
  activeTable: TableTab = 'loans';
  tableSearch = '';
  page = 1;
  readonly pageSize = 6;

  private viewReady = false;
  private chartResizeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly charts: Partial<Record<ChartKey, Chart>> = {};
  private readonly integer = new Intl.NumberFormat('es-MX');
  private readonly currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

  constructor(
    private readonly reportsService: ReportsService,
    private readonly toastr: ToastrService,
  ) {
    this.loadReport();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngOnDestroy(): void {
    if (this.chartResizeTimer) clearTimeout(this.chartResizeTimer);
    this.destroyCharts();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.snapshot || this.loading) return;
    if (this.chartResizeTimer) clearTimeout(this.chartResizeTimer);
    this.chartResizeTimer = setTimeout(() => this.renderCharts(), 180);
  }

  trackByKpi(_index: number, kpi: KpiView): KpiView['key'] {
    return kpi.key;
  }

  private buildKpis(snapshot: ReportSnapshot): KpiView[] {
    const { users, books, loans, sales, events } = snapshot.kpis;
    return [
      { key: 'users', label: 'Usuarios registrados', icon: 'ph-users-three', color: '#1565c0', value: users.value, variation: users.variation, detail: `${this.integer.format(users.period || 0)} registros en el periodo` },
      { key: 'books', label: 'Libros disponibles', icon: 'ph-books', color: '#00897b', value: books.value, detail: `${this.integer.format(books.total || 0)} ejemplares físicos totales` },
      { key: 'loans', label: 'Préstamos activos', icon: 'ph-book-bookmark', color: '#7e57c2', value: loans.value, variation: loans.variation, detail: `${this.integer.format(loans.period || 0)} movimientos en el periodo` },
      { key: 'sales', label: 'Ventas realizadas', icon: 'ph-shopping-cart', color: '#ef6c00', value: sales.value, variation: sales.variation, detail: `${this.money(sales.revenue || 0)} de ingresos` },
      { key: 'events', label: 'Eventos institucionales', icon: 'ph-calendar-star', color: '#d8436c', value: events.value, variation: events.variation, detail: 'Programados dentro del rango' },
    ];
  }

  get focusLabel(): string {
    return this.reportTypes.find((item) => item.value === this.appliedFilters.tipo_reporte)?.label || 'Panorama general';
  }

  get periodLabel(): string {
    const { fecha_inicio, fecha_fin } = this.appliedFilters;
    if (fecha_inicio && fecha_fin) return `${this.formatDate(fecha_inicio)} — ${this.formatDate(fecha_fin)}`;
    if (fecha_inicio) return `Desde ${this.formatDate(fecha_inicio)}`;
    if (fecha_fin) return `Hasta ${this.formatDate(fecha_fin)}`;
    return 'Histórico completo';
  }

  get granularityLabel(): string {
    const granularity = this.snapshot?.meta.granularity;
    if (granularity === 'month') return 'Vista mensual';
    if (granularity === 'week') return 'Vista semanal';
    return 'Vista diaria';
  }

  get filteredLoans(): LatestLoanRow[] { return this.searchRows(this.snapshot?.tables.latest_loans || []); }
  get filteredBooks(): TopBookRow[] { return this.searchRows(this.snapshot?.tables.top_books || []); }
  get filteredSales(): LatestSaleRow[] { return this.searchRows(this.snapshot?.tables.latest_sales || []); }
  get filteredActivity(): RecentActivityRow[] { return this.searchRows(this.snapshot?.tables.recent_activity || []); }

  get currentTotal(): number {
    return this.activeTable === 'loans' ? this.filteredLoans.length
      : this.activeTable === 'books' ? this.filteredBooks.length
      : this.activeTable === 'sales' ? this.filteredSales.length
      : this.filteredActivity.length;
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.currentTotal / this.pageSize)); }
  get pageStart(): number { return this.currentTotal ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.currentTotal); }
  get pagedLoans(): LatestLoanRow[] { return this.paginate(this.filteredLoans); }
  get pagedBooks(): TopBookRow[] { return this.paginate(this.filteredBooks); }
  get pagedSales(): LatestSaleRow[] { return this.paginate(this.filteredSales); }
  get pagedActivity(): RecentActivityRow[] { return this.paginate(this.filteredActivity); }

  loadReport(): void {
    if (this.filters.fecha_inicio > this.filters.fecha_fin) {
      this.toastr.warning('La fecha inicial debe ser anterior a la fecha final.');
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.destroyCharts();
    this.reportsService.getSnapshot(this.filters).subscribe({
      next: (snapshot) => {
        this.snapshot = snapshot;
        this.kpis = this.buildKpis(snapshot);
        this.appliedFilters = { ...this.filters };
        this.activeTable = this.preferredTable(this.filters.tipo_reporte);
        this.page = 1;
        this.loading = false;
        setTimeout(() => this.renderCharts());
      },
      error: (error) => {
        console.error('[Reports] No se pudo cargar el dashboard', error);
        this.errorMessage = error?.error?.message || 'No fue posible consultar la información estadística.';
        this.loading = false;
      },
    });
  }

  applyPreset(days: number): void {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    this.filters.fecha_inicio = this.localIsoDate(start);
    this.filters.fecha_fin = this.localIsoDate(end);
    this.loadReport();
  }

  clearFilters(): void {
    this.filters = this.defaultFilters();
    this.loadReport();
  }

  showSection(...types: ReportType[]): boolean {
    return this.appliedFilters.tipo_reporte === 'general' || types.includes(this.appliedFilters.tipo_reporte);
  }

  setTable(tab: TableTab): void {
    this.activeTable = tab;
    this.tableSearch = '';
    this.page = 1;
  }

  onSearch(): void { this.page = 1; }
  previousPage(): void { this.page = Math.max(1, this.page - 1); }
  nextPage(): void { this.page = Math.min(this.totalPages, this.page + 1); }

  formatNumber(value: number | null | undefined): string { return this.integer.format(Number(value || 0)); }
  money(value: number | null | undefined): string { return this.currency.format(Number(value || 0)); }

  formatDate(value: string | null | undefined, includeTime = false): string {
    if (!value) return 'Sin fecha';
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T12:00:00`
      : value.includes('T') ? value : value.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  }

  statusClass(status: string): string {
    const value = String(status || '').toLowerCase();
    if (['activo', 'activa', 'aprobado', 'pagado', 'publicado'].includes(value)) return 'rep-badge-success';
    if (['devuelto', 'finalizado', 'completado'].includes(value)) return 'rep-badge-info';
    if (['cancelado', 'cancelada', 'inactivo', 'rechazado'].includes(value)) return 'rep-badge-danger';
    return 'rep-badge-warning';
  }

  variationClass(value: number | undefined): string {
    if (!value) return 'rep-trend-neutral';
    return value > 0 ? 'rep-trend-up' : 'rep-trend-down';
  }

  async requestExport(format: 'pdf' | 'excel'): Promise<void> {
    if (!this.snapshot || this.exporting) return;

    const result = await Swal.fire({
      icon: 'question',
      title: '¿Incluir las gráficas?',
      text: format === 'excel'
        ? 'Puedes insertar cada gráfica en una hoja adicional o exportar únicamente las tablas de datos.'
        : 'Puedes agregar cada gráfica en una página individual o generar un documento únicamente con datos.',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Sí, incluir gráficas',
      denyButtonText: 'No, solo datos',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0288d1',
      denyButtonColor: '#607d8b',
      reverseButtons: true,
    });

    if (result.isDismissed) return;
    const includeCharts = result.isConfirmed;
    if (format === 'pdf') this.exportPdf(includeCharts);
    else await this.exportExcel(includeCharts);
  }

  private async exportExcel(includeCharts: boolean): Promise<void> {
    if (!this.snapshot || this.exporting) return;
    this.exporting = true;
    try {
      if (includeCharts) {
        await this.exportExcelWithCharts();
        this.toastr.success('El reporte Excel con gráficas se generó correctamente.');
        return;
      }

      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, utils.json_to_sheet(this.exportSummary()), 'Resumen');
      utils.book_append_sheet(workbook, utils.json_to_sheet(this.snapshot.tables.latest_loans), 'Prestamos');
      utils.book_append_sheet(workbook, utils.json_to_sheet(this.snapshot.tables.top_books), 'Libros solicitados');
      utils.book_append_sheet(workbook, utils.json_to_sheet(this.snapshot.tables.latest_sales), 'Ventas');
      utils.book_append_sheet(workbook, utils.json_to_sheet(this.snapshot.tables.recent_activity), 'Actividad');
      writeFile(workbook, this.fileName('xlsx'));
      this.toastr.success('El reporte Excel se generó correctamente.');
    } catch (error) {
      console.error('[Reports] Error exportando Excel', error);
      this.toastr.error('No fue posible generar el archivo Excel.');
    } finally {
      this.exporting = false;
    }
  }

  private exportPdf(includeCharts: boolean): void {
    if (!this.snapshot || this.exporting) return;
    this.exporting = true;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFillColor(2, 136, 209);
      doc.rect(0, 0, 297, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('Tiozihuatl | Reportes y Estadísticas', 14, 12);
      doc.setFontSize(9);
      doc.text(`${this.focusLabel} · ${this.periodLabel} · ${this.granularityLabel}`, 14, 20);
      doc.setTextColor(31, 53, 73);

      autoTable(doc, {
        startY: 35,
        head: [['Indicador', 'Valor', 'Detalle']],
        body: this.kpis.map((kpi) => [kpi.label, this.formatNumber(kpi.value), kpi.detail]),
        theme: 'grid',
        headStyles: { fillColor: [21, 101, 192], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 },
      });

      if (includeCharts) {
        this.getExportCharts().forEach((chart) => {
          doc.addPage();
          this.drawPdfSectionHeader(doc, chart.title, 'Gráfica incluida desde el dashboard');
          const image = this.canvasImage(chart.canvas, 2);
          const properties = doc.getImageProperties(image);
          const scale = Math.min(269 / properties.width, 155 / properties.height);
          const width = properties.width * scale;
          const height = properties.height * scale;
          doc.addImage(image, 'PNG', (297 - width) / 2, 28, width, height, undefined, 'FAST');
        });
      }

      doc.addPage();
      this.drawPdfSectionHeader(doc, 'Últimos préstamos', 'Detalle operativo del periodo seleccionado');
      autoTable(doc, {
        startY: 25,
        head: [['ID', 'Usuario', 'Libro', 'Estado', 'Préstamo', 'Vencimiento']],
        body: this.snapshot.tables.latest_loans.slice(0, 15).map((row) => [row.id_prestamo, row.usuario, row.titulo, row.estado, row.fecha_prestamo, row.fecha_vencimiento]),
        theme: 'striped',
        headStyles: { fillColor: [2, 136, 209] },
        styles: { fontSize: 7.5, cellPadding: 2 },
      });

      doc.addPage();
      this.drawPdfSectionHeader(doc, 'Ventas y actividad institucional', 'Transacciones recientes del periodo');
      autoTable(doc, {
        startY: 25,
        head: [['Venta', 'Usuario', 'Revistas', 'Total', 'Estado', 'Fecha']],
        body: this.snapshot.tables.latest_sales.slice(0, 18).map((row) => [row.id_compra, row.usuario || 'N/D', row.revistas, this.money(row.total), row.estado, row.fecha]),
        theme: 'striped',
        headStyles: { fillColor: [21, 101, 192] },
        styles: { fontSize: 7.5, cellPadding: 2 },
      });
      doc.save(this.fileName('pdf'));
      this.toastr.success(includeCharts ? 'El reporte PDF con gráficas se generó correctamente.' : 'El reporte PDF se generó correctamente.');
    } catch (error) {
      console.error('[Reports] Error exportando PDF', error);
      this.toastr.error('No fue posible generar el archivo PDF.');
    } finally {
      this.exporting = false;
    }
  }

  private async exportExcelWithCharts(): Promise<void> {
    if (!this.snapshot) return;
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Tiozihuatl';
    workbook.created = new Date();

    const addDataSheet = (name: string, headers: string[], rows: Array<Array<string | number | null>>) => {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(headers);
      const header = sheet.getRow(1);
      header.height = 24;
      header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
        cell.alignment = { vertical: 'middle' };
      });
      rows.forEach((row) => sheet.addRow(row));
      sheet.columns = headers.map((headerText, index) => ({
        header: headerText,
        key: `column_${index}`,
        width: Math.min(45, Math.max(14, headerText.length + 4)),
      }));
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
      return sheet;
    };

    addDataSheet('Resumen', ['Indicador', 'Valor', 'Detalle', 'Variación'], this.kpis.map((kpi) => [
      kpi.label, kpi.value, kpi.detail, kpi.variation === undefined ? 'N/A' : `${kpi.variation}%`,
    ]));
    addDataSheet('Préstamos', ['ID', 'Usuario', 'Matrícula', 'Libro', 'Estado', 'Préstamo', 'Vencimiento'], this.snapshot.tables.latest_loans.map((row) => [
      row.id_prestamo, row.usuario, row.matricula, row.titulo, row.estado, row.fecha_prestamo, row.fecha_vencimiento,
    ]));
    addDataSheet('Libros solicitados', ['Libro', 'Solicitudes', 'Devoluciones', 'Disponibles', 'Última solicitud'], this.snapshot.tables.top_books.map((row) => [
      row.titulo, row.solicitudes, row.devoluciones, row.disponibles, row.ultima_solicitud,
    ]));
    addDataSheet('Ventas', ['ID', 'Usuario', 'Correo', 'Revistas', 'Total', 'Estado', 'Fecha'], this.snapshot.tables.latest_sales.map((row) => [
      row.id_compra, row.usuario, row.correo, row.revistas, row.total, row.estado, row.fecha,
    ]));
    addDataSheet('Actividad', ['Tipo', 'Descripción', 'Usuario', 'Estado', 'Fecha', 'Monto'], this.snapshot.tables.recent_activity.map((row) => [
      row.tipo, row.descripcion, row.usuario, row.estado, row.fecha, row.monto,
    ]));

    const chartSheet = workbook.addWorksheet('Gráficas');
    chartSheet.properties.defaultRowHeight = 20;
    let chartRow = 1;
    this.getExportCharts().forEach((chart) => {
      chartSheet.mergeCells(chartRow, 1, chartRow, 12);
      const titleCell = chartSheet.getCell(chartRow, 1);
      titleCell.value = chart.title;
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF15558E' } };
      titleCell.alignment = { vertical: 'middle' };
      chartSheet.getRow(chartRow).height = 28;

      const imageId = workbook.addImage({ base64: this.canvasImage(chart.canvas, 2), extension: 'png' });
      chartSheet.addImage(imageId, {
        tl: { col: 0, row: chartRow },
        ext: { width: 940, height: 420 },
      });
      chartRow += 23;
    });

    // Las capturas PNG ya vienen comprimidas. Evitar DEFLATE sobre ellas reduce
    // drásticamente el tiempo de generación sin alterar su calidad visual.
    const buffer = await workbook.xlsx.writeBuffer({
      zip: { compression: 'STORE' },
    });
    this.downloadBlob(
      new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      this.fileName('xlsx'),
    );
  }

  private renderCharts(): void {
    if (!this.viewReady || !this.snapshot || this.loading) return;
    this.destroyCharts();
    const palette = ['#1565c0', '#03a9f4', '#00897b', '#7e57c2', '#ef6c00', '#d8436c'];
    const baseOptions = (): ChartConfiguration['options'] => ({
      responsive: false,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 7, padding: 16, color: '#60758a', font: { size: 11, weight: 600 } } },
        tooltip: { backgroundColor: '#17324d', padding: 11, cornerRadius: 8, titleColor: '#fff', bodyColor: '#fff' },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7890a5', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { beginAtZero: true, grid: { color: '#edf3f8' }, ticks: { color: '#7890a5', precision: 0 } },
      },
      animation: { duration: 450 },
    });

    if (this.loanTrendCanvas) {
      const rows = this.snapshot.charts.loan_trend;
      this.charts.loans = new Chart(this.prepareCanvas(this.loanTrendCanvas.nativeElement), {
        type: 'line', data: { labels: rows.map((row) => this.chartDateLabel(row.fecha)), datasets: [
          { label: 'Préstamos', data: rows.map((row) => row.prestamos), borderColor: palette[0], backgroundColor: 'rgba(21,101,192,.12)', fill: true, tension: .32, pointRadius: rows.length > 50 ? 1.5 : 3, pointHoverRadius: 5 },
          { label: 'Devoluciones', data: rows.map((row) => row.devoluciones), borderColor: palette[2], backgroundColor: 'transparent', tension: .32, pointRadius: rows.length > 50 ? 1.5 : 3, pointHoverRadius: 5 },
        ] }, options: baseOptions(),
      });
    }

    if (this.topBooksCanvas) {
      const rows = this.snapshot.charts.top_books.slice(0, 7);
      this.charts.books = new Chart(this.prepareCanvas(this.topBooksCanvas.nativeElement), {
        type: 'bar', data: { labels: rows.map((row) => this.truncate(row.titulo, 23)), datasets: [
          { label: 'Solicitudes', data: rows.map((row) => row.solicitudes), backgroundColor: palette[1], borderRadius: 6, maxBarThickness: 30 },
        ] }, options: { ...baseOptions(), indexAxis: 'y' },
      });
    }

    if (this.usersRoleCanvas) {
      const rows = this.snapshot.charts.users_by_role;
      this.charts.roles = new Chart(this.prepareCanvas(this.usersRoleCanvas.nativeElement), {
        type: 'doughnut', data: { labels: rows.map((row) => row.rol), datasets: [{ data: rows.map((row) => row.total), backgroundColor: palette, borderColor: '#fff', borderWidth: 3, hoverOffset: 6 }] },
        options: { responsive: false, maintainAspectRatio: false, cutout: '68%', plugins: baseOptions()?.plugins, animation: { duration: 450 } } as ChartConfiguration<'doughnut'>['options'],
      });
    }

    if (this.magazineSalesCanvas) {
      const rows = this.snapshot.charts.magazine_sales.slice(0, 7);
      this.charts.magazines = new Chart(this.prepareCanvas(this.magazineSalesCanvas.nativeElement), {
        type: 'bar', data: { labels: rows.map((row) => this.truncate(row.titulo, 18)), datasets: [{ label: 'Unidades vendidas', data: rows.map((row) => row.unidades), backgroundColor: palette[4], borderRadius: 6, maxBarThickness: 34 }] }, options: baseOptions(),
      });
    }

    if (this.institutionalActivityCanvas) {
      const rows = this.snapshot.charts.institutional_activity;
      this.charts.activity = new Chart(this.prepareCanvas(this.institutionalActivityCanvas.nativeElement), {
        type: 'bar', data: { labels: rows.map((row) => this.chartDateLabel(row.fecha)), datasets: [
          { label: 'Usuarios', data: rows.map((row) => row.usuarios), borderColor: palette[0], backgroundColor: 'rgba(21,101,192,.78)', borderWidth: 1, borderRadius: 4, maxBarThickness: 22 },
          { label: 'Préstamos', data: rows.map((row) => row.prestamos), borderColor: palette[2], backgroundColor: 'rgba(0,137,123,.78)', borderWidth: 1, borderRadius: 4, maxBarThickness: 22 },
          { label: 'Ventas', data: rows.map((row) => row.ventas), borderColor: palette[4], backgroundColor: 'rgba(239,108,0,.78)', borderWidth: 1, borderRadius: 4, maxBarThickness: 22 },
        ] }, options: baseOptions(),
      });
    }
  }

  private destroyCharts(): void {
    Object.values(this.charts).forEach((chart) => chart?.destroy());
    Object.keys(this.charts).forEach((key) => delete this.charts[key as ChartKey]);
  }

  private prepareCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const container = canvas.parentElement;
    if (!container) return canvas;

    const styles = getComputedStyle(container);
    const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const width = Math.max(280, Math.floor(container.clientWidth - horizontalPadding));
    const height = Math.max(190, Math.floor(container.clientHeight - verticalPadding));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    return canvas;
  }

  private getExportCharts(): ExportChart[] {
    if (!this.snapshot) return [];
    const candidates: Array<ExportChart & { hasData: boolean }> = [
      { title: 'Tendencia de préstamos', canvas: this.loanTrendCanvas?.nativeElement as HTMLCanvasElement, hasData: this.snapshot.charts.loan_trend.length > 0 },
      { title: 'Libros más solicitados', canvas: this.topBooksCanvas?.nativeElement as HTMLCanvasElement, hasData: this.snapshot.charts.top_books.length > 0 },
      { title: 'Distribución de usuarios por rol', canvas: this.usersRoleCanvas?.nativeElement as HTMLCanvasElement, hasData: this.snapshot.charts.users_by_role.length > 0 },
      { title: 'Ventas de revistas', canvas: this.magazineSalesCanvas?.nativeElement as HTMLCanvasElement, hasData: this.snapshot.charts.magazine_sales.length > 0 },
      { title: 'Actividad institucional comparativa', canvas: this.institutionalActivityCanvas?.nativeElement as HTMLCanvasElement, hasData: this.snapshot.charts.institutional_activity.length > 0 },
    ];
    return candidates.filter((chart) => chart.hasData && chart.canvas).map(({ title, canvas }) => ({ title, canvas }));
  }

  private canvasImage(canvas: HTMLCanvasElement, scale = 1): string {
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(canvas.width * scale));
    output.height = Math.max(1, Math.round(canvas.height * scale));
    const context = output.getContext('2d');
    if (!context) return canvas.toDataURL('image/png');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0, output.width, output.height);
    return output.toDataURL('image/png', 1);
  }

  private drawPdfSectionHeader(doc: jsPDF, title: string, subtitle: string): void {
    doc.setFillColor(2, 136, 209);
    doc.rect(0, 0, 297, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(title, 14, 9);
    doc.setFontSize(8);
    doc.text(subtitle, 14, 15);
    doc.setTextColor(31, 53, 73);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private defaultFilters(): ReportFilters {
    return { fecha_inicio: '', fecha_fin: '', tipo_reporte: 'general', estado: '' };
  }

  private localIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private preferredTable(type: ReportType): TableTab {
    if (type === 'libros') return 'books';
    if (type === 'ventas') return 'sales';
    if (type === 'usuarios' || type === 'eventos') return 'activity';
    return 'loans';
  }

  private searchRows<T extends object>(rows: T[]): T[] {
    const term = this.tableSearch.trim().toLocaleLowerCase('es');
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLocaleLowerCase('es').includes(term)));
  }

  private paginate<T>(rows: T[]): T[] { return rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize); }
  private chartDateLabel(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    if (this.snapshot?.meta.granularity === 'month') {
      return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(date);
    }
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(date);
  }
  private truncate(value: string, length: number): string { return value.length > length ? `${value.slice(0, length)}…` : value; }

  private exportSummary(): Record<string, string | number>[] {
    return this.kpis.map((kpi) => ({ Indicador: kpi.label, Valor: kpi.value, Detalle: kpi.detail, Variacion: kpi.variation === undefined ? 'N/A' : `${kpi.variation}%` }));
  }

  private fileName(extension: 'xlsx' | 'pdf'): string {
    const range = this.appliedFilters.fecha_inicio || this.appliedFilters.fecha_fin
      ? `${this.appliedFilters.fecha_inicio || 'inicio'}-${this.appliedFilters.fecha_fin || 'actual'}`
      : 'historico';
    return `reporte-tiozihuatl-${range}.${extension}`;
  }
}
