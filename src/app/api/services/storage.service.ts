import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment.prod';
import { API_URL } from '../api.config';

export interface UploadPdfResponse {
  success: boolean;
  message: string;
  data: {
    public_id: string;
    secure_url: string;
    format: string;
    size: number;
    created_at: string;
  };
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private baseUrl = `${API_URL}/catalog/admin`;

  constructor(private http: HttpClient) {}

  uploadPdf(file: File) {
  const token = localStorage.getItem('accessToken');
  const formData = new FormData();
  formData.append('file', file);

  return this.http.post<UploadPdfResponse>(
    `${this.baseUrl}/upload-pdf`,
    formData,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
}
}
