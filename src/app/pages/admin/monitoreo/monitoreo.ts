import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import type { ChartConfiguration, ChartType } from 'chart.js';
import { Subscription } from 'rxjs';
import { MonitoringService } from '../../../api/services/monitoring.service';
import {
  EMPTY_MONITORING_ALERTS_RESPONSE,
  MonitoringAlert,
  MonitoringAlertSeverity,
  MonitoringAlertsResponse,
  MonitoringBackup,
  MonitoringConnectionStats,
  MonitoringConnectionsResponse,
  MonitoringDashboard,
  MonitoringDatabaseResponse,
  MonitoringDbUser,
  MonitoringExtendedStats,
  MonitoringHealthPenalty,
  MonitoringHealthScore,
  MonitoringIndexesResponse,
  MonitoringLoadError,
  MonitoringLoadStep,
  MonitoringLoadStepStatus,
  MonitoringLocksResponse,
  MonitoringMaintenanceResponse,
  MonitoringPerformanceSchemaResponse,
  MonitoringPerformanceStats,
  MonitoringQueriesResponse,
  MonitoringReplicationResponse,
  MonitoringSnapshot,
  MonitoringSnapshotSource,
  MonitoringStorageResponse,
  MonitoringTopology,
  MonitoringUnusedIndex,
  NumberLike,
  MonitoringSlowQueriesSummary,
} from '../../../api/models/monitoring.models';

type MonitoringTab =
  | 'overview'
  | 'database'
  | 'connections'
  | 'performance'
  | 'security';

type MonitoringChartKey =
  | 'healthScore'
  | 'tableSizes'
  | 'connectionsUsage'
  | 'sqlOps';

@Component({
  selector: 'app-monitoreo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitoreo.html',
  styleUrls: ['./monitoreo.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoreoComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly monitoringService = inject(MonitoringService);
  private readonly numberFormatter = new Intl.NumberFormat('es-MX');
  private readonly decimalFormatter = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  private loadSubscription: Subscription | null = null;
  private chartRenderTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly charts: Partial<Record<MonitoringChartKey, Chart>> = {};
  private healthScoreCanvas?: HTMLCanvasElement;
  private tableSizesCanvas?: HTMLCanvasElement;
  private connectionsUsageCanvas?: HTMLCanvasElement;
  private sqlOpsCanvas?: HTMLCanvasElement;
  private readonly loadSources: ReadonlyArray<MonitoringSnapshotSource> = [
    'dashboard',
    'database',
    'storage',
    'indexes',
    'connections',
    'queries',
    'performance',
    'performanceSchema',
    'locks',
    'replication',
    'maintenance',
    'healthScore',
    'security',
    'backups',
    'alerts',
  ];

  activeTab: MonitoringTab = 'overview';
  loading = true;
  loadingProgress = 0;
  loadingCompleted = 0;
  loadingTotal = 0;
  loadingActiveSource: MonitoringSnapshotSource | null = null;
  loadingSteps: MonitoringLoadStep[] = [];
  loadErrors: MonitoringLoadError[] = [];

  readonly tabs: ReadonlyArray<{ id: MonitoringTab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'pulse' },
    { id: 'database', label: 'Base de Datos', icon: 'database' },
    { id: 'connections', label: 'Conexiones', icon: 'git-branch' },
    { id: 'performance', label: 'Performance', icon: 'lightning' },
    { id: 'security', label: 'Seguridad', icon: 'shield-check' },
  ];

  readonly chartColors = ['#1565C0', '#2E7D32', '#6A1B9A', '#E65100', '#F57F17', '#B71C1C'];

  dashboard: MonitoringDashboard | null = null;
  database: MonitoringDatabaseResponse | null = null;
  storage: MonitoringStorageResponse | null = null;
  indexes: MonitoringIndexesResponse | null = null;
  connections: MonitoringConnectionsResponse | null = null;
  queries: MonitoringQueriesResponse | null = null;
  performance: MonitoringPerformanceStats | null = null;
  performanceSchema: MonitoringPerformanceSchemaResponse | null = null;
  locks: MonitoringLocksResponse | null = null;
  replication: MonitoringReplicationResponse | null = null;
  maintenance: MonitoringMaintenanceResponse | null = null;
  healthScore: MonitoringHealthScore | null = null;
  dbUsers: MonitoringDbUser[] = [];
  backups: MonitoringBackup[] = [];
  alerts: MonitoringAlertsResponse = EMPTY_MONITORING_ALERTS_RESPONSE;

  @ViewChild('healthScoreChart')
  set healthScoreChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.healthScoreCanvas = ref?.nativeElement;
    this.renderHealthScoreChart();
  }

  @ViewChild('tableSizesChart')
  set tableSizesChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.tableSizesCanvas = ref?.nativeElement;
    this.renderTableSizesChart();
  }

  @ViewChild('connectionsUsageChart')
  set connectionsUsageChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.connectionsUsageCanvas = ref?.nativeElement;
    this.renderConnectionsUsageChart();
  }

  @ViewChild('sqlOpsChart')
  set sqlOpsChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.sqlOpsCanvas = ref?.nativeElement;
    this.renderSqlOpsChart();
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.loadSubscription?.unsubscribe();
      this.destroyAllCharts();

      if (this.chartRenderTimer) {
        clearTimeout(this.chartRenderTimer);
      }
    });

    this.loadAll();
  }

  get connectionStats(): MonitoringConnectionStats | null {
    return this.connections?.stats ?? this.dashboard?.connections ?? null;
  }

  get slowQueries(): MonitoringSlowQueriesSummary | null {
    return this.queries?.slow ?? this.dashboard?.slow_queries ?? null;
  }

  get performanceStats(): MonitoringPerformanceStats | null {
    return this.performance ?? this.dashboard?.performance ?? null;
  }

  get healthScoreData(): MonitoringHealthScore | null {
    return this.healthScore ?? this.maintenance?.health_score ?? null;
  }

  get healthPenalties(): MonitoringHealthPenalty[] {
    return this.healthScoreData?.penalties ?? [];
  }

  get healthScoreValue(): number {
    return Math.min(100, Math.max(0, this.healthScoreData?.score ?? 0));
  }

  get healthScoreRemaining(): number {
    return Math.max(0, 100 - this.healthScoreValue);
  }

  get hasAlerts(): boolean {
    return this.alerts.total > 0;
  }

  get alertItems(): MonitoringAlert[] {
    return this.alerts.alerts;
  }

  get connectionPct(): number {
    const stats = this.connectionStats;
    if (!stats) {
      return 0;
    }

    const fromUsage = this.parseNumber(stats.usage_percent);
    if (fromUsage !== null) {
      return Math.round(fromUsage);
    }

    const used = this.toNumber(stats.used_connections);
    const max = this.toNumber(stats.max_connections);
    if (max <= 0) {
      return 0;
    }

    return Math.round((used / max) * 100);
  }

  get connectionColor(): string {
    if (this.connectionPct >= 90) {
      return '#e74c3c';
    }

    if (this.connectionPct >= 75) {
      return '#f0932b';
    }

    return '#2a9d4e';
  }

  get bufferHitRatio(): number {
    return this.toNumber(this.performanceStats?.buffer_pool_hit_ratio);
  }

  get bufferHitColor(): string {
    if (this.bufferHitRatio >= 95) {
      return '#2a9d4e';
    }

    if (this.bufferHitRatio >= 90) {
      return '#f0932b';
    }

    return '#e74c3c';
  }

  get maxTableMB(): number {
    const values = (this.storage?.tables ?? []).map((table) => this.toNumber(table.total_mb));
    return Math.max(...values, 1);
  }

  get fragmentedCount(): number {
    return (this.storage?.fragmentation ?? []).filter(
      (item) => this.toNumber(item.fragmentation) > 30,
    ).length;
  }

  get tablesWithoutPkCount(): number {
    return this.indexes?.tables_without_pk.length ?? 0;
  }

  get unusedIndexes(): MonitoringUnusedIndex[] {
    return this.indexes?.unused_indexes ?? this.performanceSchema?.unused_indexes ?? [];
  }

  get lastBackup(): MonitoringBackup | null {
    return this.backups.length > 0 ? this.backups[0] : null;
  }

  get blockedTransactionsCount(): number {
    return this.locks?.blocked_transactions.length ?? 0;
  }

  get activeTransactionsCount(): number {
    return this.locks?.active_transactions.length ?? 0;
  }

  get currentLockWaits(): number {
    return this.toNumber(this.locks?.lock_stats?.Innodb_row_lock_current_waits);
  }

  get deadlockCount(): number {
    return this.locks?.deadlock_count ?? 0;
  }

  get deadlockPreview(): string {
    const section = this.locks?.last_deadlock?.raw_section?.trim();
    if (!section) {
      return '';
    }

    return section.length > 1200 ? `${section.slice(0, 1200)}...` : section;
  }

  get replicationLagSeconds(): number {
    return this.toNumber(this.replication?.replica_status?.seconds_behind_source);
  }

  get connectedReplicasCount(): number {
    return this.replication?.connected_replicas.length ?? 0;
  }

  get performanceSchemaEnabled(): boolean {
    return this.performanceSchema?.enabled ?? false;
  }

  get topSlowQueries() {
    return this.performanceSchema?.top_slow_queries ?? [];
  }

  get topTablesByIo() {
    return this.performanceSchema?.top_tables_by_io ?? [];
  }

  get topStorageTables() {
    return (this.storage?.tables ?? [])
      .map((table) => ({
        fullLabel: this.getTableName(table),
        shortLabel: this.compactLabel(this.getTableName(table), 18),
        value: this.toNumber(table.total_mb),
      }))
      .filter((table) => table.fullLabel !== '—' && table.value > 0)
      .slice(0, 8);
  }

  get extendedStats(): MonitoringExtendedStats | null {
    return this.performanceSchema?.extended_stats ?? null;
  }

  get tmpDiskRatio(): number | null {
    const stats = this.extendedStats;
    const directRatio = this.parseNumber(stats?.tmp_disk_ratio);
    if (directRatio !== null) {
      return directRatio;
    }

    const diskTables = this.parseNumber(stats?.Created_tmp_disk_tables);
    const tempTables = this.parseNumber(stats?.Created_tmp_tables);
    if (diskTables === null || tempTables === null) {
      return null;
    }

    const totalTables = diskTables + tempTables;
    return totalTables > 0 ? (diskTables / totalTables) * 100 : 0;
  }

  get tableCacheHitRatio(): number | null {
    const stats = this.extendedStats;
    const directRatio = this.parseNumber(stats?.table_cache_hit_ratio);
    if (directRatio !== null) {
      return directRatio;
    }

    const hits = this.parseNumber(stats?.Table_open_cache_hits);
    const misses = this.parseNumber(stats?.Table_open_cache_misses);
    if (hits === null || misses === null) {
      return null;
    }

    const totalLookups = hits + misses;
    return totalLookups > 0 ? (hits / totalLookups) * 100 : 100;
  }

  get optimizeCandidates() {
    return this.maintenance?.optimize_candidates ?? [];
  }

  get analyzeCandidates() {
    return this.maintenance?.analyze_candidates ?? [];
  }

  get sqlOps(): Array<{ label: string; value: number }> {
    const perf = this.performanceStats;
    if (!perf) {
      return [];
    }

    return [
      { label: 'SELECT', value: this.toNumber(perf.Com_select) },
      { label: 'INSERT', value: this.toNumber(perf.Com_insert) },
      { label: 'UPDATE', value: this.toNumber(perf.Com_update) },
      { label: 'DELETE', value: this.toNumber(perf.Com_delete) },
    ];
  }

  get maxSqlOp(): number {
    return Math.max(...this.sqlOps.map((item) => item.value), 1);
  }

  get sqlOpsUseLogScale(): boolean {
    const positiveValues = this.sqlOps
      .map((item) => item.value)
      .filter((value) => value > 0);

    if (positiveValues.length < 2) {
      return false;
    }

    const minValue = Math.min(...positiveValues);
    const maxValue = Math.max(...positiveValues);
    return maxValue / minValue >= 25;
  }

  get sqlOpsScaleLabel(): string {
    return this.sqlOpsUseLogScale ? 'Escala logaritmica' : 'Escala lineal';
  }

  get availableConnections(): number {
    const stats = this.connectionStats;
    if (!stats) {
      return 0;
    }

    return Math.max(
      0,
      this.toNumber(stats.max_connections) - this.toNumber(stats.used_connections),
    );
  }

  get totalTables(): number {
    const fromDatabase = this.parseNumber(this.database?.status?.total_tables);
    if (fromDatabase !== null) {
      return Math.round(fromDatabase);
    }

    return this.storage?.tables.length ?? 0;
  }

  get loadingStatusText(): string {
    if (this.loadingTotal === 0) {
      return 'Preparando solicitudes del dashboard';
    }

    return `${this.loadingCompleted} de ${this.loadingTotal} bloques sincronizados`;
  }

  get loadingCurrentLabel(): string {
    if (!this.loadingActiveSource) {
      return 'Conectando con los servicios de monitoreo';
    }

    return `Ultimo bloque: ${this.getLoadErrorLabel(this.loadingActiveSource)}`;
  }

  setTab(tabId: MonitoringTab): void {
    if (this.activeTab === tabId) {
      return;
    }

    this.destroyAllCharts();
    this.activeTab = tabId;
    this.cdr.markForCheck();
    this.queueChartRender();
  }

  refresh(): void {
    this.loadAll();
  }

  getChartColor(index: number): string {
    return this.chartColors[index % this.chartColors.length];
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  formatNumber(value: NumberLike | null | undefined): string {
    const parsed = this.parseNumber(value);
    return parsed === null ? '—' : parsed.toLocaleString('es-MX');
  }

  formatDecimal(value: NumberLike | null | undefined, decimals = 1): string {
    const parsed = this.parseNumber(value);
    return parsed === null ? '—' : parsed.toFixed(decimals);
  }

  formatPercent(value: NumberLike | null | undefined, decimals = 1): string {
    const parsed = this.parseNumber(value);
    return parsed === null ? '—' : `${parsed.toFixed(decimals)}%`;
  }

  formatMB(value: NumberLike | null | undefined): string {
    const parsed = this.parseNumber(value);
    return parsed === null ? '—' : `${parsed.toFixed(2)} MB`;
  }

  formatUptime(value: NumberLike | null | undefined): string {
    const seconds = this.parseNumber(value);
    if (seconds === null) {
      return '—';
    }

    const totalSeconds = Math.max(0, Math.floor(seconds));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  formatMetricValue(value: NumberLike | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (typeof value === 'number') {
      return this.formatNumber(value);
    }

    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : this.formatNumber(numeric);
  }

  barWidth(value: NumberLike | null | undefined, max: number): number {
    const numericValue = this.toNumber(value);
    if (max <= 0 || numericValue <= 0) {
      return 0;
    }

    return Math.max(2, (numericValue / max) * 100);
  }

  getSeverityColor(severity: MonitoringAlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '#e74c3c';
      case 'warning':
        return '#f0932b';
      default:
        return '#1e6fcf';
    }
  }

  getSeverityBadgeClass(severity: MonitoringAlertSeverity): string {
    switch (severity) {
      case 'critical':
        return 'mon-badge-red';
      case 'warning':
        return 'mon-badge-orange';
      default:
        return 'mon-badge-blue';
    }
  }

  getSeverityLabel(severity: MonitoringAlertSeverity): string {
    switch (severity) {
      case 'critical':
        return 'Critica';
      case 'warning':
        return 'Advertencia';
      default:
        return 'Info';
    }
  }

  getHealthStatusColor(status: MonitoringHealthScore['status'] | null | undefined): string {
    switch (status) {
      case 'healthy':
        return '#2a9d4e';
      case 'good':
        return '#1e6fcf';
      case 'warning':
        return '#f0932b';
      default:
        return '#e74c3c';
    }
  }

  getHealthStatusLabel(status: MonitoringHealthScore['status'] | null | undefined): string {
    switch (status) {
      case 'healthy':
        return 'Saludable';
      case 'good':
        return 'Estable';
      case 'warning':
        return 'En observacion';
      default:
        return 'Critico';
    }
  }

  getTopologyLabel(topology: MonitoringTopology | null | undefined): string {
    switch (topology) {
      case 'replica':
        return 'Replica';
      case 'source':
        return 'Source';
      default:
        return 'Standalone';
    }
  }

  getTopologyBadgeClass(topology: MonitoringTopology | null | undefined): string {
    switch (topology) {
      case 'replica':
        return 'mon-badge-orange';
      case 'source':
        return 'mon-badge-blue';
      default:
        return 'mon-badge-gray';
    }
  }

  getMetricLabel(metric: string): string {
    const labels: Record<string, string> = {
      buffer_pool_hit_ratio: 'Buffer Pool Hit Ratio',
      connection_usage_pct: 'Uso de conexiones',
      row_lock_current_waits: 'Locks activos',
      select_full_join: 'JOINs sin indice',
      tmp_disk_ratio_pct: 'Tmp en disco',
      aborted_connections: 'Conexiones abortadas',
    };

    return labels[metric] ?? metric.replace(/_/g, ' ');
  }

  getLoadErrorLabel(source: MonitoringLoadError['source']): string {
    const labels: Record<MonitoringLoadError['source'], string> = {
      dashboard: 'Dashboard',
      database: 'Base de datos',
      storage: 'Almacenamiento',
      indexes: 'Indices',
      connections: 'Conexiones',
      queries: 'Queries',
      performance: 'Performance',
      performanceSchema: 'Performance Schema',
      locks: 'Locks',
      replication: 'Replicacion',
      maintenance: 'Mantenimiento',
      healthScore: 'Health score',
      security: 'Seguridad',
      backups: 'Backups',
      alerts: 'Alertas',
    };

    return labels[source];
  }

  getLoadStepClass(status: MonitoringLoadStepStatus): string {
    switch (status) {
      case 'success':
        return 'mon-load-step-success';
      case 'error':
        return 'mon-load-step-error';
      default:
        return 'mon-load-step-pending';
    }
  }

  getLoadStepIcon(status: MonitoringLoadStepStatus): string {
    switch (status) {
      case 'success':
        return 'ph ph-check-circle';
      case 'error':
        return 'ph ph-warning-circle';
      default:
        return 'ph ph-clock-countdown';
    }
  }

  getTableName(value: unknown): string {
    return this.getRecordText(value, [
      'table_name',
      'TABLE_NAME',
      'tableName',
      'tabla',
      'TABLE',
    ]);
  }

  getColumnName(value: unknown): string {
    return this.getRecordText(value, [
      'column_name',
      'COLUMN_NAME',
      'columnName',
      'columna',
    ]);
  }

  getEngineName(value: unknown): string {
    return this.getRecordText(value, ['engine', 'ENGINE', 'Engine', 'motor'], 'N/A');
  }

  getTableRows(value: unknown): NumberLike | null {
    return this.getRecordNumberLike(value, [
      'table_rows',
      'TABLE_ROWS',
      'tableRows',
      'rows',
      'filas',
    ]);
  }

  private loadAll(): void {
    const initialSteps = this.createPendingLoadSteps();

    this.loadSubscription?.unsubscribe();
    this.destroyAllCharts();
    this.loading = true;
    this.loadingProgress = 0;
    this.loadingCompleted = 0;
    this.loadingTotal = initialSteps.length;
    this.loadingActiveSource = null;
    this.loadingSteps = initialSteps;
    this.loadErrors = [];
    this.cdr.markForCheck();

    this.loadSubscription = this.monitoringService
      .loadSnapshotProgress()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.loadingProgress = state.progress;
          this.loadingCompleted = state.completed;
          this.loadingTotal = state.total;
          this.loadingActiveSource = state.activeSource;
          this.loadingSteps = state.steps;

          if (!state.loading) {
            if (state.snapshot) {
              this.applySnapshot(state.snapshot);
            }
            this.loading = false;
            this.queueChartRender();
          }

          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('[Monitoring] Error loading snapshot', error);
          this.resetState();
          this.loading = false;
          this.loadErrors = [
            {
              source: 'dashboard',
              status: (error as { status?: number })?.status,
              message: 'No se pudo cargar el panel de monitoreo.',
            },
          ];
          this.destroyAllCharts();
          this.cdr.markForCheck();
        },
      });
  }

  private applySnapshot(snapshot: MonitoringSnapshot): void {
    this.dashboard = snapshot.dashboard;
    this.database = snapshot.database;
    this.storage = snapshot.storage;
    this.indexes = snapshot.indexes;
    this.connections = snapshot.connections;
    this.queries = snapshot.queries;
    this.performance = snapshot.performance ?? snapshot.dashboard?.performance ?? null;
    this.performanceSchema = snapshot.performanceSchema;
    this.locks = snapshot.locks;
    this.replication = snapshot.replication;
    this.maintenance = snapshot.maintenance;
    this.healthScore = snapshot.healthScore ?? snapshot.maintenance?.health_score ?? null;
    this.dbUsers = snapshot.security;
    this.backups = snapshot.backups;
    this.alerts = snapshot.alerts ?? snapshot.dashboard?.alerts ?? EMPTY_MONITORING_ALERTS_RESPONSE;
    this.loadErrors = snapshot.errors;
  }

  private resetState(): void {
    this.dashboard = null;
    this.database = null;
    this.storage = null;
    this.indexes = null;
    this.connections = null;
    this.queries = null;
    this.performance = null;
    this.performanceSchema = null;
    this.locks = null;
    this.replication = null;
    this.maintenance = null;
    this.healthScore = null;
    this.dbUsers = [];
    this.backups = [];
    this.alerts = EMPTY_MONITORING_ALERTS_RESPONSE;
    this.destroyAllCharts();
  }

  private parseNumber(value: NumberLike | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  toNumber(value: NumberLike | null | undefined): number {
    return this.parseNumber(value) ?? 0;
  }

  private getRecordText(
    value: unknown,
    keys: ReadonlyArray<string>,
    fallback = '—',
  ): string {
    const record = this.toRecord(value);
    if (!record) {
      return fallback;
    }

    for (const key of keys) {
      const current = record[key];
      if (current !== null && current !== undefined && current !== '') {
        return String(current);
      }
    }

    return fallback;
  }

  private getRecordNumberLike(
    value: unknown,
    keys: ReadonlyArray<string>,
  ): NumberLike | null {
    const record = this.toRecord(value);
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const current = record[key];
      if (current !== null && current !== undefined && current !== '') {
        if (typeof current === 'number' || typeof current === 'string') {
          return current;
        }

        if (typeof current === 'bigint') {
          return current.toString();
        }

        return String(current);
      }
    }

    return null;
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private createPendingLoadSteps(): MonitoringLoadStep[] {
    return this.loadSources.map((source) => ({
      source,
      status: 'pending',
    }));
  }

  private queueChartRender(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.chartRenderTimer) {
      clearTimeout(this.chartRenderTimer);
    }

    this.chartRenderTimer = setTimeout(() => {
      this.chartRenderTimer = null;
      this.renderVisibleCharts();
    }, 0);
  }

  private renderVisibleCharts(): void {
    if (this.loading || typeof window === 'undefined') {
      return;
    }

    this.renderHealthScoreChart();
    this.renderTableSizesChart();
    this.renderConnectionsUsageChart();
    this.renderSqlOpsChart();
  }

  private renderHealthScoreChart(): void {
    if (this.activeTab !== 'overview' || !this.healthScoreCanvas || !this.healthScoreData) {
      this.destroyChart('healthScore');
      return;
    }

    this.upsertChart('healthScore', this.healthScoreCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Health score', 'Pendiente'],
        datasets: [
          {
            data: [this.healthScoreValue, this.healthScoreRemaining],
            backgroundColor: [
              this.getHealthStatusColor(this.healthScoreData.status),
              '#e3ebf5',
            ],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: this.buildDoughnutOptions((label, value) => `${label}: ${value}/100`),
    });
  }

  private renderTableSizesChart(): void {
    if (
      this.activeTab !== 'database' ||
      !this.tableSizesCanvas ||
      this.topStorageTables.length === 0
    ) {
      this.destroyChart('tableSizes');
      return;
    }

    this.upsertChart('tableSizes', this.tableSizesCanvas, {
      type: 'bar',
      data: {
        labels: this.topStorageTables.map((table) => table.shortLabel),
        datasets: [
          {
            label: 'MB totales',
            data: this.topStorageTables.map((table) => table.value),
            backgroundColor: this.topStorageTables.map((_, index) => this.getChartColor(index)),
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 22,
          },
        ],
      },
      options: this.buildHorizontalBarOptions(
        (value) => `${this.decimalFormatter.format(value)} MB`,
      ),
    });
  }

  private renderConnectionsUsageChart(): void {
    if (
      this.activeTab !== 'connections' ||
      !this.connectionsUsageCanvas ||
      !this.connectionStats
    ) {
      this.destroyChart('connectionsUsage');
      return;
    }

    this.upsertChart('connectionsUsage', this.connectionsUsageCanvas, {
      type: 'doughnut',
      data: {
        labels: ['En uso', 'Disponibles'],
        datasets: [
          {
            data: [
              this.toNumber(this.connectionStats.used_connections),
              this.availableConnections,
            ],
            backgroundColor: [this.connectionColor, '#d8e2ef'],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: this.buildDoughnutOptions(
        (label, value) => `${label}: ${this.numberFormatter.format(value)}`,
      ),
    });
  }

  private renderSqlOpsChart(): void {
    if (this.activeTab !== 'performance' || !this.sqlOpsCanvas || this.sqlOps.length === 0) {
      this.destroyChart('sqlOps');
      return;
    }

    this.upsertChart('sqlOps', this.sqlOpsCanvas, {
      type: 'bar',
      data: {
        labels: this.sqlOps.map((item) => item.label),
        datasets: [
          {
            label: 'Operaciones',
            data: this.sqlOps.map((item) => item.value),
            backgroundColor: this.sqlOps.map((_, index) => this.getChartColor(index)),
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 42,
          },
        ],
      },
      options: this.buildVerticalBarOptions(this.sqlOpsUseLogScale),
    });
  }

  private buildDoughnutOptions(
    labelFormatter: (label: string, value: number) => string,
  ): ChartConfiguration<'doughnut'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      animation: {
        duration: 500,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 10,
            color: '#556677',
            font: {
              family: 'Inter',
              size: 11,
              weight: 600,
            },
            padding: 14,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              labelFormatter(context.label, Number(context.parsed) || 0),
          },
        },
      },
    };
  }

  private buildHorizontalBarOptions(
    valueFormatter: (value: number) => string,
  ): ChartConfiguration<'bar'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      animation: {
        duration: 500,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => valueFormatter(Number(context.parsed.x) || 0),
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            color: '#6b7b8d',
            callback: (value) => valueFormatter(Number(value)),
          },
          grid: {
            color: 'rgba(30,111,207,0.08)',
          },
          border: {
            display: false,
          },
        },
        y: {
          ticks: {
            color: '#334155',
            font: {
              family: 'JetBrains Mono',
              size: 11,
            },
          },
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
        },
      },
    };
  }

  private buildVerticalBarOptions(useLogScale: boolean): ChartConfiguration<'bar'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 500,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${this.numberFormatter.format(Number(context.parsed.y) || 0)} operaciones`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#334155',
            font: {
              family: 'JetBrains Mono',
              size: 11,
            },
          },
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
        },
        y: {
          type: useLogScale ? 'logarithmic' : 'linear',
          beginAtZero: true,
          min: useLogScale ? 1 : 0,
          ticks: {
            color: '#6b7b8d',
            callback: (value) => {
              const numericValue = Number(value);

              if (useLogScale) {
                const safeValue = Math.max(1, numericValue);
                const exponent = Math.log10(safeValue);
                const isPowerOfTen = Number.isInteger(exponent);

                return isPowerOfTen ? this.numberFormatter.format(numericValue) : '';
              }

              return this.numberFormatter.format(numericValue);
            },
          },
          grid: {
            color: 'rgba(30,111,207,0.08)',
          },
          border: {
            display: false,
          },
        },
      },
    };
  }

  private upsertChart<K extends MonitoringChartKey, TType extends ChartType>(
    key: K,
    canvas: HTMLCanvasElement,
    config: ChartConfiguration<TType>,
  ): void {
    const existing = this.charts[key];
    if (existing) {
      existing.destroy();
    }

    this.charts[key] = new Chart(canvas, config) as Chart;
  }

  private destroyChart(key: MonitoringChartKey): void {
    const chart = this.charts[key];
    if (chart) {
      chart.destroy();
      delete this.charts[key];
    }
  }

  private destroyAllCharts(): void {
    (Object.keys(this.charts) as MonitoringChartKey[]).forEach((key) =>
      this.destroyChart(key),
    );
  }

  private compactLabel(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }
}
