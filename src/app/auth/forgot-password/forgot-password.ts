import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../api/services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class ForgotPasswordComponent {
  correo = '';
  cargando = false;

  constructor(private auth: AuthService, private router: Router) {}

  irALogin() {
    this.router.navigate(['/login']);
  }

  async enviarCorreo() {
    if (!this.correo) {
      Swal.fire('Correo requerido', 'Ingresa tu correo para continuar.', 'info');
      return;
    }

    this.cargando = true;
    try {
      const res: any = await this.auth
        .forgotPassword({ correo: this.correo })
        .toPromise();

      const mensaje = res?.message || '';

      // 🚫 Caso: demasiados intentos
      if (mensaje.includes("varios")) {
        Swal.fire({
          icon: 'warning',
          title: 'Límite alcanzado',
          text: mensaje,
          confirmButtonColor: '#F59E0B',
        });
        return;
      }

      // ✔ Caso normal
      Swal.fire({
        icon: 'success',
        title: 'Correo enviado',
        text: mensaje, // “Si el correo está registrado…”
        confirmButtonColor: '#3B82F6',
      });

    } catch (err: any) {
      const msg =
        err?.error?.error || 'Error al enviar el enlace de recuperación.';
      Swal.fire('Error', msg, 'error');
    } finally {
      this.cargando = false;
    }
  }
}
