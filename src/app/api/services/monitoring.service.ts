import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class MonitoringService {

  private api = `${API_URL}/monitoring`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ----------------------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------------------

  getDashboard() {
    return this.http.get<any>(`${this.api}/dashboard`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
  // DATABASE
  // ----------------------------------------------------------------

  getDatabaseStatus() {
    return this.http.get<any>(`${this.api}/database/status`, {
      headers: this.getAuthHeaders()
    });
  }

  getDatabaseSize() {
    return this.http.get<any>(`${this.api}/database/size`, {
      headers: this.getAuthHeaders()
    });
  }

  getTables() {
    return this.http.get<any[]>(`${this.api}/database/tables`, {
      headers: this.getAuthHeaders()
    });
  }

  getIndexes() {
    return this.http.get<any[]>(`${this.api}/database/indexes`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
  // CONNECTIONS
  // ----------------------------------------------------------------

  getConnections() {
    return this.http.get<any>(`${this.api}/connections`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
  // QUERIES
  // ----------------------------------------------------------------

  getActiveQueries() {
    return this.http.get<any[]>(`${this.api}/queries/active`, {
      headers: this.getAuthHeaders()
    });
  }

  getSlowQueries() {
    return this.http.get<any>(`${this.api}/queries/slow`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
  // PERFORMANCE
  // ----------------------------------------------------------------

  getPerformanceTables() {
    return this.http.get<any>(`${this.api}/performance/tables`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
  // GROWTH
  // ----------------------------------------------------------------

  getGrowth() {
    return this.http.get<any[]>(`${this.api}/growth`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
  // SECURITY
  // ----------------------------------------------------------------

  getAuditEvents(params: {
    limit?:  number;
    offset?: number;
    userId?: number | null;
    action?: string | null;
  } = {}) {
    let httpParams = new HttpParams();
    if (params.limit  != null) httpParams = httpParams.set('limit',  params.limit);
    if (params.offset != null) httpParams = httpParams.set('offset', params.offset);
    if (params.userId != null) httpParams = httpParams.set('userId', params.userId);
    if (params.action != null) httpParams = httpParams.set('action', params.action);

    return this.http.get<{ total: number; data: any[] }>(
      `${this.api}/security/events`,
      { headers: this.getAuthHeaders(), params: httpParams }
    );
  }

  getActiveSessions() {
    return this.http.get<{ total: number; data: any[] }>(
      `${this.api}/security/sessions`,
      { headers: this.getAuthHeaders() }
    );
  }

  getActiveTokens() {
    return this.http.get<{ total: number; data: any[] }>(
      `${this.api}/security/tokens`,
      { headers: this.getAuthHeaders() }
    );
  }

  // ----------------------------------------------------------------
  // BACKUPS
  // ----------------------------------------------------------------

  getBackupHistory(params: { limit?: number; offset?: number } = {}) {
    let httpParams = new HttpParams();
    if (params.limit  != null) httpParams = httpParams.set('limit',  params.limit);
    if (params.offset != null) httpParams = httpParams.set('offset', params.offset);

    return this.http.get<any[]>(
      `${this.api}/backups`,
      { headers: this.getAuthHeaders(), params: httpParams }
    );
  }

  // ----------------------------------------------------------------
  // ANÁLISIS DE PRODUCCIÓN
  // ----------------------------------------------------------------

  getAnalysis() {
    return this.http.get<any>(`${this.api}/analysis`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
  // SCHEDULED JOBS
  // ----------------------------------------------------------------

  getScheduledJobs() {
    return this.http.get<any[]>(`${this.api}/jobs`, {
      headers: this.getAuthHeaders()
    });
  }

  // ----------------------------------------------------------------
// BUSINESS MONITORING
// ----------------------------------------------------------------

// Actividad general del sistema
getSystemActivity() {
  return this.http.get<any>(`${this.api}/system/activity`, {
    headers: this.getAuthHeaders()
  });
}

// Biblioteca
getLibraryStats() {
  return this.http.get<any>(`${this.api}/library/stats`, {
    headers: this.getAuthHeaders()
  });
}

getMostBorrowedBooks() {
  return this.http.get<any[]>(`${this.api}/library/top-borrowed`, {
    headers: this.getAuthHeaders()
  });
}

// Ventas / revistas
getSalesStats() {
  return this.http.get<any>(`${this.api}/sales/stats`, {
    headers: this.getAuthHeaders()
  });
}

getTopSellingMagazines() {
  return this.http.get<any[]>(`${this.api}/sales/top-magazines`, {
    headers: this.getAuthHeaders()
  });
}

// Usuarios
getUsersByRole() {
  return this.http.get<any[]>(`${this.api}/users/by-role`, {
    headers: this.getAuthHeaders()
  });
}

getMostActiveUsers() {
  return this.http.get<any[]>(`${this.api}/users/most-active`, {
    headers: this.getAuthHeaders()
  });
}

// Académico
getAcademicStats() {
  return this.http.get<any>(`${this.api}/academic/stats`, {
    headers: this.getAuthHeaders()
  });
}
}