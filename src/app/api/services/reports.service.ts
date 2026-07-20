import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { ReportFilters, ReportSnapshot } from '../models/reports.models';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = `${API_URL}/reports`;

  constructor(private readonly http: HttpClient) {}

  getSnapshot(filters: ReportFilters): Observable<ReportSnapshot> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ReportSnapshot>(`${this.api}/snapshot`, { params });
  }
}
