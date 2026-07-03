import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from '../api.config';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  private api = `${API_URL}/payments`;

  constructor(private http: HttpClient) {}

  createPreference(data: any) {
    const token = localStorage.getItem('accessToken') || '';

    return this.http.post(
      `${this.api}/create-preference`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }
}
