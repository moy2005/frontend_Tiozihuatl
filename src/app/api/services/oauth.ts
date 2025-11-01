import { Injectable } from '@angular/core';
import { environment } from '../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class OauthService {
  private api = environment.apiUrl;

  login(provider: 'google' | 'facebook') {
    // Redirección directa
    window.location.href = `${this.api}/oauth/${provider}`;
  }
}
