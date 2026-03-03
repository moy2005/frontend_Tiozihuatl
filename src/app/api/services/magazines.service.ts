import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpHeaders } from '@angular/common/http';
@Injectable({
  providedIn: 'root'
})
export class MagazinesService {

  private api = 'http://localhost:4000/api/magazines';

  constructor(private http: HttpClient) {}

  /* ===========================
     ADMIN
  =========================== */

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/admin`);
  }

  create(data: FormData) {
    const token = localStorage.getItem('accessToken');

    return this.http.post(
      `${this.api}/admin/upload`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }

  getById(id: number) {
  return this.http.get<any>(`${this.api}/${id}`);
}

  update(id: number, data: FormData) {
    return this.http.put(`${this.api}/admin/${id}`, data);
  }

  toggleStatus(id: number) {
  return this.http.patch(
    `${this.api}/admin/${id}/toggle-status`,
    {}
  );
}


  /* ===========================
     CATÁLOGO PÚBLICO
  =========================== */

  getCatalog(): Observable<any[]> {
  return this.http.get<any[]>(`${this.api}`);
}

  /* ===========================
     PDF SEGURO
  =========================== */

  getSecurePdf(id: number) {

    const token = localStorage.getItem('accessToken');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<{ url: string }>(
      `${this.api}/secure-pdf/${id}`,
      { headers }
    );
  }

  /* ===========================
     🔥 CREATE PURCHASE (LO QUE FALTABA)
  =========================== */

 createPurchase(items: any[]) {
    return this.http.post(
      `${this.api}/purchase`,
      { items }
    );
  }
  savePurchase(ids: number[]) {
    return this.http.post('/api/magazines/purchase', {
      magazineIds: ids
    });
  }


  /* ===========================
     PROGRESO DE LECTURA
  =========================== */

  saveProgress(data: any) {
    return this.http.post(`${this.api}/progress`, data);
  }

  getProgress(id: number) {
    return this.http.get(`${this.api}/progress/${id}`);
  }
  getAuditoria(filtros: any) {
    return this.http.get<any[]>(
      `${this.api}/admin/auditoria-compras`,
      { params: filtros }
    );
  }


    

}
