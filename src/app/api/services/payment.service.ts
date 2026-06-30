import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from '../api.config';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  private api = `${API_URL}/payments`;

  constructor(private http: HttpClient) {}

  createCheckoutSession(data: any) {
    const token = localStorage.getItem('accessToken') || '';

    return this.http.post(
      `${this.api}/create-checkout-session`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }
}