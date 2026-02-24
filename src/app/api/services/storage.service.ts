import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment.prod'


@Injectable({ providedIn: 'root' })
export class StorageService {

  private readonly API_URL = `${environment.apiUrl}/catalog/admin`;

  //private API_URL = 'http://localhost:4000/api/catalog/admin';

  constructor(private http: HttpClient) {}

  uploadPdf(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<any>(
      `${this.API_URL}/upload-pdf`,
      formData
    );
  }
}