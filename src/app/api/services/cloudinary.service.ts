import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {

  private cloudName = 'dxq0apa5a';
  private uploadPreset = 'pdf_libros';

  private apiUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/raw/upload`;

  constructor(private http: HttpClient) {}

  uploadPdf(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    return this.http.post<any>(this.apiUrl, formData);
  }
  //Parte del calendario
  uploadFile(file: File, type: 'image' | 'raw') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', this.uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/${type}/upload`;

  return this.http.post<any>(url, formData);
}

}
