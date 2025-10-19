import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
})
export class DashboardComponent implements OnInit {
  user: any = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.obtenerUsuarioActual();
    }
  }

  /** Decodificar token y mostrar usuario */
obtenerUsuarioActual() {
  if (!isPlatformBrowser(this.platformId)) return;

  try {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

    if (!token) {
      Swal.fire({
        icon: 'info',
        title: 'Sesión no encontrada',
        text: 'Por favor inicia sesión nuevamente.',
        confirmButtonColor: '#3B82F6',
      }).then(() => this.router.navigate(['/login']));
      return;
    }

    // Obtener datos del usuario desde localStorage (para login, biometric, OTP)
    const userDataStr = localStorage.getItem('user') || localStorage.getItem('userData');
    const userData = userDataStr ? JSON.parse(userDataStr) : {};

    console.log('📦 UserData de localStorage:', userData);

    // Decodificar token JWT como fallback
    const decoded: any = jwtDecode(token);
    console.log('🔑 Token decodificado:', decoded);

    // Combinar datos de localStorage (user o userData) con el token
    this.user = {
      id: userData.id_usuario || decoded.id_usuario || decoded.id,
      nombre: userData.nombre || decoded.nombre || 'Usuario',
      a_paterno: userData.a_paterno || decoded.a_paterno || '',
      a_materno: userData.a_materno || decoded.a_materno || '',
      correo: userData.correo || decoded.correo,
      telefono: userData.telefono || decoded.telefono || '',
      metodo: userData.metodo_autenticacion || decoded.metodo_autenticacion || 'OAuth',
      estado: userData.estado || decoded.estado || 'Activo'
    };

    // Si el correo es temporal de Facebook, mostrar advertencia amigable
    if (this.user.correo?.startsWith('facebook_')) {
      this.user.correoDisplay = `${this.user.nombre} (Facebook)`;
      this.user.esEmailTemporal = true;
    } else {
      this.user.correoDisplay = this.user.correo;
      this.user.esEmailTemporal = false;
    }

    console.log('👤 Usuario final:', this.user);
  } catch (error) {
    console.error('❌ Error al leer datos del usuario:', error);
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}

  /** 🚪 Cerrar sesión */
  async logout() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      await this.auth.logout().toPromise();
    } catch (err) {
      console.warn('⚠️ Error al cerrar sesión:', err);
    }

    localStorage.clear();

    Swal.fire({
      icon: 'success',
      title: 'Sesión cerrada',
      text: 'Has cerrado sesión correctamente.',
      timer: 1500,
      showConfirmButton: false,
    });

    setTimeout(() => this.router.navigate(['/login']), 1500);
  }
}