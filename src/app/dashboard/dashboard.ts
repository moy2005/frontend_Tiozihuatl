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
    try {
      const token =
        localStorage.getItem('accessToken') || localStorage.getItem('token');

      if (!token) {
        Swal.fire({
          icon: 'info',
          title: 'Sesión no encontrada',
          text: 'Por favor inicia sesión nuevamente.',
          confirmButtonColor: '#3B82F6',
        }).then(() => this.router.navigate(['/login']));
        return;
      }

      const decoded: any = jwtDecode(token);
      console.log('🔑 Token decodificado:', decoded);

      this.user = {
        id: decoded.id_usuario || decoded.id,
        nombre: decoded.nombre,
        a_paterno: decoded.a_paterno || '',
        a_materno: decoded.a_materno || '',
        correo: decoded.correo,
        telefono: decoded.telefono,
        metodo: decoded.metodo_autenticacion || 'SMS',
        estado: decoded.estado || 'Activo',
      };
    } catch (error) {
      console.error('❌ Error al leer token:', error);
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
