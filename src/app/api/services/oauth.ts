import { Injectable } from '@angular/core';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class OauthService {
  private api = `${API_URL}`;

  login(provider: 'google' | 'facebook') {
    // Redirección directa
    window.location.href = `${this.api}/oauth/${provider}`;
  }
}

