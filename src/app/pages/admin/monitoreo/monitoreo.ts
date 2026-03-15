import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonitoringService } from '../../../api/services/monitoring.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-monitoreo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monitoreo.html',
  styleUrls: ['./monitoreo.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MonitoreoComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // ── Estado general ──────────────────────────────────────────────────────
  activeTab: string = 'overview';
  loading:   boolean = true;
  lastRefresh: Date = new Date();

  tabs = [
    { id: 'overview',  label: 'Overview',      icon: 'pulse-outline' },
    { id: 'library',   label: 'Biblioteca',    icon: 'book-outline' },
    { id: 'sales',     label: 'Ventas',        icon: 'cart-outline' },
    { id: 'users',     label: 'Usuarios',      icon: 'people-outline' },
    { id: 'database',  label: 'Base de Datos', icon: 'server-outline' },
    { id: 'security',  label: 'Seguridad',     icon: 'shield-checkmark-outline' },
  ];

  // ── Datos del dashboard (shape exacto de la API) ─────────────────────────

  // /monitoring/dashboard
  dashboard: any = null;

  // Shortcuts desde dashboard
  get sysAct()    { return this.dashboard?.system_activity; }
  get libStats()  { return this.dashboard?.library_stats; }
  get salesStats(){ return this.dashboard?.sales_stats; }
  get dbStatus()  { return this.dashboard?.database; }
  get connStats() { return this.dashboard?.connections; }

  // /monitoring/library/top-borrowed
  borrowedBooks: any[] = [];

  // /monitoring/sales/top-magazines
  topMagazines: any[] = [];

  // /monitoring/users/by-role
  usersByRole: any[] = [];

  // /monitoring/users/most-active
  mostActiveUsers: any[] = [];

  // /monitoring/academic/stats
  academicStats: any = null;

  // /monitoring/growth
  growth: any[] = [];

  // /monitoring/database/tables
  tables: any[] = [];

  // /monitoring/security/events
  auditEvents: { total: number; data: any[] } | null = null;
  auditFilter = { userId: null as number | null, action: null as string | null, limit: 50, offset: 0 };
  auditActions = ['LOGIN', 'LOGOUT', 'COMPRA', 'PRESTAMO', 'REGISTRO', 'ACTUALIZACION'];

  // /monitoring/security/sessions
  activeSessions: { total: number; data: any[] } | null = null;

  // /monitoring/security/tokens
  activeTokens: { total: number; data: any[] } | null = null;

  // ── Gráficas (bar widths calculados en %) ────────────────────────────────
  get maxBorrowedBooks(): number {
    return this.borrowedBooks.length ? this.borrowedBooks[0].total_prestamos : 1;
  }
  get maxMagazineSales(): number {
    return this.topMagazines.length ? this.topMagazines[0].ventas : 1;
  }
  get maxActiveEvents(): number {
    return this.mostActiveUsers.length ? this.mostActiveUsers[0].eventos : 1;
  }
  get totalUsersByRole(): number {
    return this.usersByRole.reduce((s, r) => s + r.total, 0) || 1;
  }
  get maxTableSize(): number {
    return this.tables.length ? Math.max(...this.tables.map(t => parseFloat(t.total_mb) || 0)) : 1;
  }
  get maxGrowthRows(): number {
    return this.growth.length ? Math.max(...this.growth.map(g => g.rows_estimate ?? 0)) : 1;
  }
  get totalMagazineSales(): number {
    return this.topMagazines.reduce((s, m) => s + m.ventas, 0) || 1;
  }

  // Conexiones: porcentaje de uso
  get connectionPct(): number {
    if (!this.connStats) return 0;
    return Math.round((this.connStats.threads_connected / this.connStats.max_connections) * 100);
  }
  get connectionColor(): string {
    const p = this.connectionPct;
    if (p > 80) return '#B71C1C';
    if (p > 60) return '#E65100';
    return '#2E7D32';
  }

  // Backup color
  get backupColor(): string {
    return this.dashboard?.last_backup?.estado === 'exitoso' ? '#2E7D32' : '#B71C1C';
  }

  // Libros: préstamos total para barra
  get totalLoanStates(): number {
    return (this.libStats?.prestamos_activos ?? 0) + (this.libStats?.prestamos_vencidos ?? 0) || 1;
  }
  get loanActiveWidth(): number {
    return ((this.libStats?.prestamos_activos ?? 0) / this.totalLoanStates) * 100;
  }
  get loanExpiredWidth(): number {
    return ((this.libStats?.prestamos_vencidos ?? 0) / this.totalLoanStates) * 100;
  }

  // Colores para gráficas
  chartColors = ['#1565C0', '#2E7D32', '#6A1B9A', '#E65100', '#F57F17', '#B71C1C', '#0277BD'];

  getChartColor(i: number): string {
    return this.chartColors[i % this.chartColors.length];
  }

  getAuditEventColor(tipo: string): string {
    const map: Record<string, string> = {
      LOGIN: '#2E7D32', LOGOUT: '#E65100', COMPRA: '#F57F17',
      PRESTAMO: '#1565C0', REGISTRO: '#6A1B9A', ACTUALIZACION: '#4527A0',
    };
    return map[tipo] ?? '#455A64';
  }

  // Mapeo de tab IDs a iconos Phosphor (solo visual)
  getPhosphorIcon(tabId: string): string {
    const icons: Record<string, string> = {
      overview: 'pulse',
      library: 'books',
      sales: 'shopping-cart',
      users: 'users-three',
      database: 'database',
      security: 'shield-check',
    };
    return icons[tabId] ?? 'squares-four';
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  constructor(private monitoringService: MonitoringService) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Carga de datos ───────────────────────────────────────────────────────

  loadAll(): void {
    this.loading = true;
    console.group('%c[Monitoreo] Iniciando carga de datos', 'color:#00d4ff;font-weight:bold');

    // Wrappea cada llamada para que nunca falle el forkJoin
    const safe = <T>(key: string, obs: any, fallback: T) =>
      new Promise<T>(resolve =>
        obs.subscribe({
          next: (val: T) => {
            console.log(`%c✔ ${key}`, 'color:#00e096', val);
            resolve(val);
          },
          error: (err: any) => {
            console.warn(`%c✘ ${key} — FALLÓ (usando fallback)`, 'color:#ff4560', err?.status, err?.message);
            resolve(fallback);
          }
        })
      );

    Promise.all([
      safe('dashboard',       this.monitoringService.getDashboard(),              null),
      safe('borrowedBooks',   this.monitoringService.getMostBorrowedBooks(),      []),
      safe('topMagazines',    this.monitoringService.getTopSellingMagazines(),    []),
      safe('usersByRole',     this.monitoringService.getUsersByRole(),            []),
      safe('mostActiveUsers', this.monitoringService.getMostActiveUsers(),        []),
      safe('academicStats',   this.monitoringService.getAcademicStats(),          null),
      safe('growth',          this.monitoringService.getGrowth(),                 []),
      safe('tables',          this.monitoringService.getTables(),                 []),
      safe('activeSessions',  this.monitoringService.getActiveSessions(),         null),
      safe('activeTokens',    this.monitoringService.getActiveTokens(),           null),
    ]).then(([
      dashboard, borrowedBooks, topMagazines, usersByRole,
      mostActiveUsers, academicStats, growth, tables,
      activeSessions, activeTokens
    ]) => {
      this.dashboard       = dashboard;
      this.borrowedBooks   = (borrowedBooks   as any[]) ?? [];
      this.topMagazines    = (topMagazines    as any[]) ?? [];
      this.usersByRole     = (usersByRole     as any[]) ?? [];
      this.mostActiveUsers = (mostActiveUsers as any[]) ?? [];
      this.academicStats   = academicStats;
      this.growth          = (growth  as any[]) ?? [];
      this.tables          = (tables  as any[]) ?? [];
      this.activeSessions  = activeSessions as any;
      this.activeTokens    = activeTokens   as any;

      console.log('%c[Monitoreo] Resumen final cargado:', 'color:#00d4ff;font-weight:bold', {
        dashboard:       this.dashboard,
        sysAct:          this.sysAct,
        libStats:        this.libStats,
        salesStats:      this.salesStats,
        dbStatus:        this.dbStatus,
        connStats:       this.connStats,
        borrowedBooks:   this.borrowedBooks.length,
        topMagazines:    this.topMagazines.length,
        usersByRole:     this.usersByRole.length,
        mostActiveUsers: this.mostActiveUsers.length,
        academicStats:   this.academicStats,
        growth:          this.growth.length,
        tables:          this.tables.length,
        activeSessions:  this.activeSessions,
        activeTokens:    this.activeTokens,
      });
      console.groupEnd();

      this.loading     = false;
      this.lastRefresh = new Date();

      // Auditoría por separado (tiene filtros propios)
      this.loadAuditEvents();
    });
  }

  loadAuditEvents(): void {
    console.log('%c[Monitoreo] Cargando auditoría con filtros:', 'color:#7c3aed', this.auditFilter);
    this.monitoringService.getAuditEvents({
      limit:  this.auditFilter.limit,
      offset: this.auditFilter.offset,
      userId: this.auditFilter.userId,
      action: this.auditFilter.action,
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        console.log('%c✔ auditEvents', 'color:#00e096', res);
        this.auditEvents = res;
      },
      error: (err) => {
        console.warn('%c✘ auditEvents — FALLÓ', 'color:#ff4560', err?.status, err?.message);
      }
    });
  }

  // ── Helpers de template ──────────────────────────────────────────────────

  setTab(id: string): void {
    this.activeTab = id;
  }

  refresh(): void {
    this.loadAll();
  }

  applyAuditFilter(): void {
    this.auditFilter.offset = 0;
    this.loadAuditEvents();
  }

  clearAuditFilter(): void {
    this.auditFilter = { userId: null, action: null, limit: 50, offset: 0 };
    this.loadAuditEvents();
  }

  nextAuditPage(): void {
    this.auditFilter.offset += this.auditFilter.limit;
    this.loadAuditEvents();
  }

  prevAuditPage(): void {
    this.auditFilter.offset = Math.max(0, this.auditFilter.offset - this.auditFilter.limit);
    this.loadAuditEvents();
  }

  get auditCurrentPage(): number {
    return Math.floor(this.auditFilter.offset / this.auditFilter.limit) + 1;
  }
  get auditTotalPages(): number {
    return this.auditEvents ? Math.ceil(this.auditEvents.total / this.auditFilter.limit) : 1;
  }

  formatDate(d: any): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }

  formatNumber(n: any): string {
    if (n == null) return '—';
    return Number(n).toLocaleString('es-MX');
  }

  formatMB(n: any): string {
    if (n == null) return '—';
    return `${Number(n).toFixed(2)} MB`;
  }

  formatCurrency(n: any): string {
    if (n == null) return '—';
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  }

  barWidth(value: number, max: number): number {
    if (!max) return 0;
    return Math.max(2, (value / max) * 100);
  }

  pieSegment(value: number, total: number): string {
    // Retorna el stroke-dasharray para un SVG circle de r=15.9
    const pct = total ? (value / total) * 100 : 0;
    return `${pct} ${100 - pct}`;
  }

  // Acumulado para pie chart (stroke-dashoffset)
  pieOffset(index: number): number {
    if (!this.usersByRole.length) return 0;
    let offset = 25; // empieza en la parte superior (25 = 90deg)
    for (let i = 0; i < index; i++) {
      offset -= (this.usersByRole[i].total / this.totalUsersByRole) * 100;
    }
    return offset;
  }

  magazinePieOffset(index: number): number {
    if (!this.topMagazines.length) return 0;
    let offset = 25;
    for (let i = 0; i < index; i++) {
      offset -= (this.topMagazines[i].ventas / this.totalMagazineSales) * 100;
    }
    return offset;
  }
}