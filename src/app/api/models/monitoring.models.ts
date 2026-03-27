export type NumberLike = number | string;

export type MonitoringAlertSeverity = 'info' | 'warning' | 'critical';
export type MonitoringHealthStatus = 'healthy' | 'good' | 'warning' | 'critical';
export type MonitoringTopology = 'replica' | 'source' | 'standalone';

export type MonitoringSnapshotSource =
  | 'dashboard'
  | 'database'
  | 'storage'
  | 'indexes'
  | 'connections'
  | 'queries'
  | 'performance'
  | 'performanceSchema'
  | 'locks'
  | 'replication'
  | 'maintenance'
  | 'healthScore'
  | 'security'
  | 'backups'
  | 'alerts';

export interface MonitoringDatabaseStatus {
  db_name: string;
  total_tables: NumberLike;
  total_rows: NumberLike;
  total_size_mb: NumberLike;
}

export interface MonitoringDatabaseEngine {
  engine: string | null;
  total: NumberLike;
}

export interface MonitoringDatabaseResponse {
  status: MonitoringDatabaseStatus | null;
  engines: MonitoringDatabaseEngine[];
}

export interface MonitoringStorageTable {
  table_name: string;
  total_mb: NumberLike;
  table_rows: NumberLike;
}

export interface MonitoringFragmentationTable {
  table_name: string;
  fragmentation: NumberLike | null;
}

export interface MonitoringStorageResponse {
  tables: MonitoringStorageTable[];
  fragmentation: MonitoringFragmentationTable[];
}

export interface MonitoringIndexRow {
  table_name: string;
  index_name: string;
  column_name: string;
}

export interface MonitoringTableWithoutPk {
  table_name: string;
}

export interface MonitoringUnusedIndex {
  db_name: string;
  table_name: string;
  index_name: string;
  total_accesses: NumberLike;
  index_type: string | null;
  non_unique: NumberLike;
  seq_in_index: NumberLike;
  column_name: string;
}

export interface MonitoringIndexesResponse {
  indexes: MonitoringIndexRow[];
  tables_without_pk: MonitoringTableWithoutPk[];
  unused_indexes: MonitoringUnusedIndex[];
}

export interface MonitoringConnectionStats {
  max_connections: NumberLike;
  used_connections: NumberLike;
  usage_percent: NumberLike;
  threads_running: NumberLike;
}

export interface MonitoringProcessListItem {
  Id: NumberLike;
  User: string;
  db: string | null;
  Command: string;
  Time: NumberLike;
  State: string | null;
  Info?: string | null;
}

export interface MonitoringConnectionsResponse {
  stats: MonitoringConnectionStats | null;
  process_list: MonitoringProcessListItem[];
}

export interface MonitoringActiveQuery {
  id: NumberLike;
  user: string;
  db: string | null;
  command: string;
  time: NumberLike;
  state: string | null;
  query: string | null;
}

export interface MonitoringSlowQueriesSummary {
  slow_queries: NumberLike;
  long_query_time: NumberLike;
}

export interface MonitoringQueriesResponse {
  active: MonitoringActiveQuery[];
  slow: MonitoringSlowQueriesSummary | null;
}

export interface MonitoringPerformanceStats {
  Queries?: NumberLike;
  Com_select?: NumberLike;
  Com_insert?: NumberLike;
  Com_update?: NumberLike;
  Com_delete?: NumberLike;
  Uptime?: NumberLike;
  Threads_connected?: NumberLike;
  Innodb_buffer_pool_read_requests?: NumberLike;
  Innodb_buffer_pool_reads?: NumberLike;
  buffer_pool_hit_ratio?: NumberLike;
}

export interface MonitoringExtendedStats {
  Innodb_row_lock_waits?: NumberLike;
  Innodb_row_lock_time?: NumberLike;
  Innodb_row_lock_time_avg?: NumberLike;
  Innodb_row_lock_time_max?: NumberLike;
  Innodb_row_lock_current_waits?: NumberLike;
  Innodb_pages_read?: NumberLike;
  Innodb_pages_written?: NumberLike;
  Innodb_pages_created?: NumberLike;
  Innodb_os_log_written?: NumberLike;
  Innodb_buffer_pool_wait_free?: NumberLike;
  Innodb_log_waits?: NumberLike;
  Com_commit?: NumberLike;
  Com_rollback?: NumberLike;
  Com_begin?: NumberLike;
  Aborted_connects?: NumberLike;
  Aborted_clients?: NumberLike;
  Connection_errors_max_connections?: NumberLike;
  Table_open_cache_hits?: NumberLike;
  Table_open_cache_misses?: NumberLike;
  Table_open_cache_overflows?: NumberLike;
  Sort_merge_passes?: NumberLike;
  Created_tmp_disk_tables?: NumberLike;
  Created_tmp_tables?: NumberLike;
  Select_full_join?: NumberLike;
  Select_scan?: NumberLike;
  Handler_read_rnd_next?: NumberLike;
  tmp_disk_ratio?: NumberLike;
  table_cache_hit_ratio?: NumberLike;
}

export interface MonitoringDbUser {
  user: string;
  host: string;
}

export interface MonitoringBackup {
  fecha?: string | null;
  estado?: string | null;
  tamanio_mb?: NumberLike | null;
  [key: string]: unknown;
}

export interface MonitoringAlert {
  id: string;
  severity: MonitoringAlertSeverity;
  category: string;
  message: string;
  value: NumberLike | string | null;
  threshold: NumberLike | string | null;
  recommendation: string;
  timestamp: string;
  is_new: boolean;
}

export interface MonitoringAlertsResponse {
  total: number;
  critical: number;
  warning: number;
  info: number;
  alerts: MonitoringAlert[];
  evaluated_at: string;
}

export interface MonitoringDashboard {
  database: MonitoringDatabaseStatus | null;
  connections: MonitoringConnectionStats | null;
  slow_queries: MonitoringSlowQueriesSummary | null;
  performance: MonitoringPerformanceStats | null;
  alerts: MonitoringAlertsResponse;
}

export interface MonitoringLockStats {
  Innodb_row_lock_waits?: NumberLike;
  Innodb_row_lock_time?: NumberLike;
  Innodb_row_lock_time_avg?: NumberLike;
  Innodb_row_lock_time_max?: NumberLike;
  Innodb_row_lock_current_waits?: NumberLike;
  Table_locks_waited?: NumberLike;
  Table_locks_immediate?: NumberLike;
}

export interface MonitoringBlockedTransaction {
  waiting_trx_id: string;
  waiting_thread: NumberLike;
  waiting_query: string | null;
  waiting_started: string;
  waiting_seconds: NumberLike;
  blocking_trx_id: string;
  blocking_thread: NumberLike;
  blocking_query: string | null;
  blocking_started: string;
}

export interface MonitoringActiveTransaction {
  trx_id: string;
  trx_state: string;
  trx_started: string;
  duration_seconds: NumberLike;
  trx_requested_lock_id: string | null;
  trx_wait_started: string | null;
  trx_weight: NumberLike;
  trx_mysql_thread_id: NumberLike;
  trx_query: string | null;
  trx_rows_locked: NumberLike;
  trx_rows_modified: NumberLike;
  trx_isolation_level: string | null;
}

export interface MonitoringDeadlockInfo {
  raw_section: string | null;
  has_deadlock: boolean;
  full_status_available: boolean;
}

export interface MonitoringLocksResponse {
  blocked_transactions: MonitoringBlockedTransaction[];
  active_transactions: MonitoringActiveTransaction[];
  lock_stats: MonitoringLockStats | null;
  last_deadlock: MonitoringDeadlockInfo | null;
  deadlock_count: number | null;
}

export interface MonitoringReplicaStatus {
  is_replica: boolean;
  source_host: string | null;
  source_port: NumberLike | null;
  replica_io_running: string | null;
  replica_sql_running: string | null;
  seconds_behind_source: NumberLike | null;
  last_io_error: string | null;
  last_sql_error: string | null;
  last_io_errno: NumberLike | null;
  last_sql_errno: NumberLike | null;
  relay_log_pos: NumberLike | null;
  exec_source_log_pos: NumberLike | null;
  retrieved_gtid_set: string | null;
  executed_gtid_set: string | null;
  auto_position: NumberLike | null;
  is_healthy: boolean;
}

export interface MonitoringSourceStatus {
  is_source: boolean;
  file: string;
  position: NumberLike;
  binlog_do_db: string | null;
  binlog_ignore_db: string | null;
  executed_gtid_set: string | null;
}

export interface MonitoringReplicationResponse {
  replica_status: MonitoringReplicaStatus | null;
  source_status: MonitoringSourceStatus | null;
  connected_replicas: Array<Record<string, unknown>>;
  topology: MonitoringTopology;
}

export interface MonitoringSlowQueryDigest {
  digest: string;
  query_pattern: string;
  db_name: string | null;
  executions: NumberLike;
  avg_ms: NumberLike;
  max_ms: NumberLike;
  min_ms: NumberLike;
  total_ms: NumberLike;
  total_rows_examined: NumberLike;
  total_rows_sent: NumberLike;
  avg_rows_examined: NumberLike;
  avg_rows_sent: NumberLike;
  full_scans: NumberLike;
  bad_index_uses: NumberLike;
  first_seen: string | null;
  last_seen: string | null;
}

export interface MonitoringTableIoStats {
  db_name: string;
  table_name: string;
  total_reads: NumberLike;
  total_writes: NumberLike;
  fetches: NumberLike;
  inserts: NumberLike;
  updates: NumberLike;
  deletes: NumberLike;
  total_ops: NumberLike;
}

export interface MonitoringPerformanceSchemaResponse {
  enabled: boolean;
  message?: string;
  top_slow_queries?: MonitoringSlowQueryDigest[];
  unused_indexes?: MonitoringUnusedIndex[];
  top_tables_by_io?: MonitoringTableIoStats[];
  extended_stats?: MonitoringExtendedStats | null;
}

export interface MonitoringOptimizeCandidate {
  table_name: string;
  engine: string;
  table_rows: NumberLike;
  data_mb: NumberLike;
  index_mb: NumberLike;
  wasted_mb: NumberLike;
  fragmentation_pct: NumberLike;
  total_mb: NumberLike;
}

export interface MonitoringAnalyzeCandidate {
  table_name: string;
  table_rows: NumberLike;
  total_mb: NumberLike;
  create_time: string | null;
  update_time: string | null;
  check_time: string | null;
  analyze_status: string;
}

export interface MonitoringHealthPenalty {
  metric: string;
  value: NumberLike;
  penalty: number;
  severity: Exclude<MonitoringAlertSeverity, 'info'>;
}

export interface MonitoringHealthScore {
  score: number;
  grade: string;
  status: MonitoringHealthStatus;
  penalties: MonitoringHealthPenalty[];
  calculated_at: string;
}

export interface MonitoringMaintenanceResponse {
  optimize_candidates: MonitoringOptimizeCandidate[];
  analyze_candidates: MonitoringAnalyzeCandidate[];
  health_score: MonitoringHealthScore | null;
}

export interface MonitoringPerformanceSchemaOptions {
  limit?: number;
  minAvgMs?: number;
}

export interface MonitoringLoadError {
  source: MonitoringSnapshotSource;
  status?: number;
  message: string;
}

export type MonitoringLoadStepStatus = 'pending' | 'success' | 'error';

export interface MonitoringLoadStep {
  source: MonitoringSnapshotSource;
  status: MonitoringLoadStepStatus;
}

export interface MonitoringSnapshot {
  dashboard: MonitoringDashboard | null;
  database: MonitoringDatabaseResponse | null;
  storage: MonitoringStorageResponse | null;
  indexes: MonitoringIndexesResponse | null;
  connections: MonitoringConnectionsResponse | null;
  queries: MonitoringQueriesResponse | null;
  performance: MonitoringPerformanceStats | null;
  performanceSchema: MonitoringPerformanceSchemaResponse | null;
  locks: MonitoringLocksResponse | null;
  replication: MonitoringReplicationResponse | null;
  maintenance: MonitoringMaintenanceResponse | null;
  healthScore: MonitoringHealthScore | null;
  security: MonitoringDbUser[];
  backups: MonitoringBackup[];
  alerts: MonitoringAlertsResponse;
  errors: MonitoringLoadError[];
}

export interface MonitoringSnapshotProgress {
  snapshot: MonitoringSnapshot | null;
  completed: number;
  total: number;
  progress: number;
  activeSource: MonitoringSnapshotSource | null;
  loading: boolean;
  steps: MonitoringLoadStep[];
}

export const EMPTY_MONITORING_ALERTS_RESPONSE: MonitoringAlertsResponse = {
  total: 0,
  critical: 0,
  warning: 0,
  info: 0,
  alerts: [],
  evaluated_at: '',
};
