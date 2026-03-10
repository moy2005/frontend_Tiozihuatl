import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../api/environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  private readonly apiUrl = `${environment.apiUrl}/calendarios`;

  constructor(private readonly http: HttpClient) {}

  // Público (Alumno)
  getCalendarPublic(tipo: string) {
    return this.http.get(`${this.apiUrl}/public/${tipo}`);
  }

  // Docente 
  getCalendarDocente() {
    return this.http.get(`${this.apiUrl}/docente`);
  }
}