import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class AutomationService {

  private api = `${API_URL}/automation`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {

    const token = localStorage.getItem('accessToken');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

  }

  /** Crear tarea */

  createBackupTask(data:any){

    return this.http.post(
      `${this.api}/task`,
      data,
      { headers:this.getAuthHeaders() }
    );

  }

  /** Obtener tareas */

  getTasks(){

    return this.http.get(
      `${this.api}/tasks`,
      { headers:this.getAuthHeaders() }
    );

  }

  /** Activar / Desactivar */

  toggleTask(id:number){

    return this.http.patch(
      `${this.api}/task/${id}/toggle`,
      {},
      { headers:this.getAuthHeaders() }
    );

  }

  /** Eliminar */

  deleteTask(id:number){

    return this.http.delete(
      `${this.api}/task/${id}`,
      { headers:this.getAuthHeaders() }
    );

  }

}