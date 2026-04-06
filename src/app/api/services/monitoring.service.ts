import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, filter, map, of, startWith, take, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_URL } from '../api.config';
import {
  EMPTY_MONITORING_ALERTS_RESPONSE,
  MonitoringAlertsResponse,
  MonitoringConnectionsResponse,
  MonitoringDashboard,
  MonitoringDatabaseResponse,
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
  MonitoringSnapshot,
  MonitoringSnapshotProgress,
  MonitoringSnapshotSource,
  MonitoringStorageResponse,
} from '../models/monitoring.models';

interface MonitoringRequestResult<T> {
  data: T;
  error: MonitoringLoadError | null;
}

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly api = `${API_URL}/monitoring`;
  private readonly requestTimeoutMs = 15000;

  constructor(private readonly http: HttpClient) {}

  getSnapshot(
    options: MonitoringPerformanceSchemaOptions = {},
    forceRefresh = false,
  ): Observable<MonitoringSnapshot> {
    return this.get<MonitoringSnapshot>('/snapshot', {
      limit: options.limit,
      min_avg_ms: options.minAvgMs,
      force: forceRefresh || undefined,
    });
  }

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

  getMaintenance(): Observable<MonitoringMaintenanceResponse> {
    return this.get<MonitoringMaintenanceResponse>('/maintenance');
  }

  getHealthScore(): Observable<MonitoringHealthScore> {
    return this.get<MonitoringHealthScore>('/health-score');
  }

  getAlerts(): Observable<MonitoringAlertsResponse> {
    return this.get<MonitoringAlertsResponse>('/alerts');
  }

  loadSnapshot(
    options: MonitoringPerformanceSchemaOptions = { limit: 10, minAvgMs: 5 },
    forceRefresh = false,
  ): Observable<MonitoringSnapshot> {
    return this.loadSnapshotProgress(options, forceRefresh).pipe(
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
    forceRefresh = false,
  ): Observable<MonitoringSnapshotProgress> {
    const source: MonitoringSnapshotSource = 'snapshot';
    const initialState: MonitoringSnapshotProgress = {
      snapshot: null,
      completed: 0,
      total: 1,
      progress: 0,
      activeSource: null,
      loading: true,
      steps: [
        {
          source,
          status: 'pending',
        },
      ],
    };

    return this.capture(
      source,
      this.getSnapshot(options, forceRefresh),
      null,
    ).pipe(
      map((result) => ({
        snapshot: result.data ?? this.buildEmptySnapshot(result.error),
        completed: 1,
        total: 1,
        progress: 100,
        activeSource: source,
        loading: false,
        steps: [
          {
            source,
            status: result.error ? 'error' : 'success',
          } as MonitoringLoadStep,
        ],
      })),
      startWith(initialState),
    );
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

  private buildEmptySnapshot(error: MonitoringLoadError | null): MonitoringSnapshot {
    return {
      dashboard: null,
      database: null,
      storage: null,
      indexes: null,
      connections: null,
      queries: null,
      performance: null,
      performanceSchema: null,
      locks: null,
      maintenance: null,
      healthScore: null,
      alerts: EMPTY_MONITORING_ALERTS_RESPONSE,
      errors: error ? [error] : [],
    };
  }
}

export {
  EMPTY_MONITORING_ALERTS_RESPONSE,
  type MonitoringAlertsResponse,
  type MonitoringConnectionsResponse,
  type MonitoringDashboard,
  type MonitoringDatabaseResponse,
  type MonitoringDeadlockInfo,
  type MonitoringHealthScore,
  type MonitoringIndexesResponse,
  type MonitoringLocksResponse,
  type MonitoringMaintenanceResponse,
  type MonitoringPerformanceSchemaResponse,
  type MonitoringPerformanceStats,
  type MonitoringQueriesResponse,
  type MonitoringStorageResponse,
};
