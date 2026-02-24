import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class StorageService {

  private API_URL = 'http://localhost:4000/api/catalog/admin';

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