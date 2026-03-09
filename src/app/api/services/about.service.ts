import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';

export interface AboutItem {
  id_about: number;
  type: 'MISION' | 'VISION' | 'VALORES';
  title: string;
  content: string;
  status: 'Activo' | 'Inactivo';
}

@Injectable({ providedIn: 'root' })
export class AboutService {

  private apiUrl = `${API_URL}/about`;

  constructor(private http: HttpClient) {}

  getAllPublic(): Observable<AboutItem[]> {
    return this.http.get<AboutItem[]>(this.apiUrl);
  }
}
