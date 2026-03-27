import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  Observable,
  filter,
  map,
  merge,
  of,
  scan,
  startWith,
  take,
  timeout,
} from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_URL } from '../api.config';
import {
  EMPTY_MONITORING_ALERTS_RESPONSE,
  MonitoringAlertsResponse,
  MonitoringBackup,
  MonitoringConnectionsResponse,
  MonitoringDashboard,
  MonitoringDatabaseResponse,
  MonitoringDbUser,
  MonitoringDeadlockInfo,
  MonitoringHealthScore,
  MonitoringIndexesResponse,
  MonitoringLoadError,
  MonitoringLoadStep,
  MonitoringLocksResponse,
  MonitoringMaintenanceResponse,
  MonitoringPerformanceSchemaOptions,
  MonitoringPerformanceSchemaResponse,
  MonitoringPerformanceStats,
  MonitoringQueriesResponse,
  MonitoringReplicationResponse,
  MonitoringSnapshot,
  MonitoringSnapshotProgress,
  MonitoringSnapshotSource,
  MonitoringStorageResponse,
} from '../models/monitoring.models';

interface MonitoringRequestResult<T> {
  data: T;
  error: MonitoringLoadError | null;
}

interface MonitoringRequestDefinition<T> {
  source: MonitoringSnapshotSource;
  request$: Observable<MonitoringRequestResult<T>>;
}

type MonitoringRequestMap = Partial<
  Record<MonitoringSnapshotSource, MonitoringRequestResult<unknown>>
>;

interface MonitoringProgressAccumulator extends MonitoringSnapshotProgress {
  rawResults: MonitoringRequestMap;
}

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly api = `${API_URL}/monitoring`;
  private readonly requestTimeoutMs = 15000;

  constructor(private readonly http: HttpClient) {}

  getDashboard(): Observable<MonitoringDashboard> {
    return this.get<MonitoringDashboard>('/dashboard');
  }

  getDatabaseStatus(): Observable<MonitoringDatabaseResponse> {
    return this.get<MonitoringDatabaseResponse>('/database');
  }

  getStorage(): Observable<MonitoringStorageResponse> {
    return this.get<MonitoringStorageResponse>('/storage');
  }

  getIndexes(): Observable<MonitoringIndexesResponse> {
    return this.get<MonitoringIndexesResponse>('/indexes');
  }

  getConnections(): Observable<MonitoringConnectionsResponse> {
    return this.get<MonitoringConnectionsResponse>('/connections');
  }

  getQueries(): Observable<MonitoringQueriesResponse> {
    return this.get<MonitoringQueriesResponse>('/queries');
  }

  getPerformance(): Observable<MonitoringPerformanceStats> {
    return this.get<MonitoringPerformanceStats>('/performance');
  }

  getPerformanceSchema(
    options: MonitoringPerformanceSchemaOptions = {},
  ): Observable<MonitoringPerformanceSchemaResponse> {
    return this.get<MonitoringPerformanceSchemaResponse>('/performance-schema', {
      limit: options.limit,
      min_avg_ms: options.minAvgMs,
    });
  }

  getLocks(): Observable<MonitoringLocksResponse> {
    return this.get<MonitoringLocksResponse>('/locks');
  }

  getLastDeadlock(): Observable<MonitoringDeadlockInfo> {
    return this.get<MonitoringDeadlockInfo>('/locks/deadlock');
  }

  getReplication(): Observable<MonitoringReplicationResponse> {
    return this.get<MonitoringReplicationResponse>('/replication');
  }

  getMaintenance(): Observable<MonitoringMaintenanceResponse> {
    return this.get<MonitoringMaintenanceResponse>('/maintenance');
  }

  getHealthScore(): Observable<MonitoringHealthScore> {
    return this.get<MonitoringHealthScore>('/health-score');
  }

  getSecurity(): Observable<MonitoringDbUser[]> {
    return this.get<MonitoringDbUser[]>('/security');
  }

  getBackups(): Observable<MonitoringBackup[]> {
    return this.get<MonitoringBackup[]>('/backups');
  }

  getAlerts(): Observable<MonitoringAlertsResponse> {
    return this.get<MonitoringAlertsResponse>('/alerts');
  }

  loadSnapshot(
    options: MonitoringPerformanceSchemaOptions = { limit: 10, minAvgMs: 5 },
  ): Observable<MonitoringSnapshot> {
    return this.loadSnapshotProgress(options).pipe(
      filter(
        (state): state is MonitoringSnapshotProgress & { snapshot: MonitoringSnapshot } =>
          !state.loading && state.snapshot !== null,
      ),
      map((state) => state.snapshot),
      take(1),
    );
  }

  loadSnapshotProgress(
    options: MonitoringPerformanceSchemaOptions = { limit: 10, minAvgMs: 5 },
  ): Observable<MonitoringSnapshotProgress> {
    const requests = this.buildSnapshotRequests(options);
    const total = requests.length;
    const initialState: MonitoringProgressAccumulator = {
      rawResults: {},
      snapshot: null,
      completed: 0,
      total,
      progress: 0,
      activeSource: null,
      loading: true,
      steps: requests.map(
        ({ source }): MonitoringLoadStep => ({
          source,
          status: 'pending',
        }),
      ),
    };

    return merge(
      ...requests.map(({ source, request$ }) =>
        request$.pipe(map((result) => ({ source, result }))),
      ),
    ).pipe(
      scan<{
        source: MonitoringSnapshotSource;
        result: MonitoringRequestResult<unknown>;
      }, MonitoringProgressAccumulator>((state, entry) => {
        const rawResults: MonitoringRequestMap = {
          ...state.rawResults,
          [entry.source]: entry.result,
        };

        const completed = state.completed + 1;

        return {
          rawResults,
          snapshot:
            completed === total ? this.buildSnapshotFromResults(rawResults) : null,
          completed,
          total,
          progress: Math.round((completed / total) * 100),
          activeSource: entry.source,
          loading: completed < total,
          steps: state.steps.map((step) =>
            step.source === entry.source
              ? {
                  ...step,
                  status: entry.result.error ? 'error' : 'success',
                }
              : step,
          ),
        };
      }, initialState),
      startWith(initialState),
      map(({ rawResults: _rawResults, ...state }) => state),
    );
  }

  private buildSnapshotRequests(
    options: MonitoringPerformanceSchemaOptions,
  ): MonitoringRequestDefinition<unknown>[] {
    return [
      {
        source: 'dashboard',
        request$: this.capture('dashboard', this.getDashboard(), null),
      },
      {
        source: 'database',
        request$: this.capture('database', this.getDatabaseStatus(), null),
      },
      {
        source: 'storage',
        request$: this.capture('storage', this.getStorage(), null),
      },
      {
        source: 'indexes',
        request$: this.capture('indexes', this.getIndexes(), null),
      },
      {
        source: 'connections',
        request$: this.capture('connections', this.getConnections(), null),
      },
      {
        source: 'queries',
        request$: this.capture('queries', this.getQueries(), null),
      },
      {
        source: 'performance',
        request$: this.capture('performance', this.getPerformance(), null),
      },
      {
        source: 'performanceSchema',
        request$: this.capture(
          'performanceSchema',
          this.getPerformanceSchema(options),
          null,
        ),
      },
      {
        source: 'locks',
        request$: this.capture('locks', this.getLocks(), null),
      },
      {
        source: 'replication',
        request$: this.capture('replication', this.getReplication(), null),
      },
      {
        source: 'maintenance',
        request$: this.capture('maintenance', this.getMaintenance(), null),
      },
      {
        source: 'healthScore',
        request$: this.capture('healthScore', this.getHealthScore(), null),
      },
      {
        source: 'security',
        request$: this.capture('security', this.getSecurity(), []),
      },
      {
        source: 'backups',
        request$: this.capture('backups', this.getBackups(), []),
      },
      {
        source: 'alerts',
        request$: this.capture(
          'alerts',
          this.getAlerts(),
          EMPTY_MONITORING_ALERTS_RESPONSE,
        ),
      },
    ];
  }

  private buildSnapshotFromResults(
    rawResults: MonitoringRequestMap,
  ): MonitoringSnapshot {
    const read = <T>(source: MonitoringSnapshotSource, fallback: T): T => {
      const result = rawResults[source] as MonitoringRequestResult<T> | undefined;
      return result ? result.data : fallback;
    };

    const dashboard = read<MonitoringDashboard | null>('dashboard', null);
    const database = read<MonitoringDatabaseResponse | null>('database', null);
    const storage = read<MonitoringStorageResponse | null>('storage', null);
    const indexes = read<MonitoringIndexesResponse | null>('indexes', null);
    const connections = read<MonitoringConnectionsResponse | null>(
      'connections',
      null,
    );
    const queries = read<MonitoringQueriesResponse | null>('queries', null);
    const performance = read<MonitoringPerformanceStats | null>('performance', null);
    const performanceSchema = read<MonitoringPerformanceSchemaResponse | null>(
      'performanceSchema',
      null,
    );
    const locks = read<MonitoringLocksResponse | null>('locks', null);
    const replication = read<MonitoringReplicationResponse | null>(
      'replication',
      null,
    );
    const maintenance = read<MonitoringMaintenanceResponse | null>(
      'maintenance',
      null,
    );
    const healthScore = read<MonitoringHealthScore | null>('healthScore', null);
    const security = read<MonitoringDbUser[]>('security', []);
    const backups = read<MonitoringBackup[]>('backups', []);
    const directAlerts = read<MonitoringAlertsResponse>(
      'alerts',
      EMPTY_MONITORING_ALERTS_RESPONSE,
    );

    const alerts = rawResults.alerts?.error
      ? dashboard?.alerts ?? directAlerts
      : directAlerts;

    const resolvedPerformance = rawResults.performance?.error
      ? dashboard?.performance ?? null
      : performance;

    const resolvedHealthScore = rawResults.healthScore?.error
      ? maintenance?.health_score ?? null
      : healthScore;

    const errors = Object.values(rawResults)
      .map((entry) => entry?.error ?? null)
      .filter((entry): entry is MonitoringLoadError => entry !== null);

    return {
      dashboard,
      database,
      storage,
      indexes,
      connections,
      queries,
      performance: resolvedPerformance,
      performanceSchema,
      locks,
      replication,
      maintenance,
      healthScore: resolvedHealthScore,
      security,
      backups,
      alerts,
      errors,
    };
  }

  private get<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>,
  ): Observable<T> {
    let params = new HttpParams();

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          params = params.set(key, String(value));
        }
      }
    }

    return this.http.get<T>(`${this.api}${path}`, { params });
  }

  private capture<T>(
    source: MonitoringSnapshotSource,
    request$: Observable<T>,
    fallback: T,
  ): Observable<MonitoringRequestResult<T>> {
    return request$.pipe(
      timeout(this.requestTimeoutMs),
      map((data) => ({ data, error: null })),
      catchError((error: unknown) => {
        console.error(`[Monitoring] Error loading ${source}`, error);

        const isTimeout = (error as { name?: string })?.name === 'TimeoutError';
        const httpError = error as HttpErrorResponse;

        const message = isTimeout
          ? 'Tiempo de espera agotado al cargar el recurso.'
          : typeof httpError.error?.message === 'string'
            ? httpError.error.message
            : 'No se pudo cargar el recurso.';

        return of({
          data: fallback,
          error: {
            source,
            status: isTimeout ? undefined : httpError.status || undefined,
            message,
          },
        });
      }),
    );
  }
}
