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
  palabra_secreta = '';
  cargando = false;

  constructor(private auth: AuthService, private router: Router) {}

  irALogin() {
    this.router.navigate(['/login']);
  }

  irARegistro() {
    this.router.navigate(['/register']);
  }

  async enviarCorreo() {
    if (!this.correo || !this.palabra_secreta) {
      Swal.fire(
        'Datos requeridos',
        'Ingresa tu correo y tu palabra secreta.',
        'info'
      );
      return;
    }

    this.cargando = true;

    try {
      const res: any = await this.auth
        .forgotPassword({
          correo: this.correo,
          palabra_secreta: this.palabra_secreta
        })
        .toPromise();

      // 🟦 CASO: palabra secreta incorrecta
      if (res?.error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: res.message,
          confirmButtonColor: '#DC2626'
        });
        return;
      }

      const mensaje = res?.message || '';

      // 🚫 límite de intentos activado
      if (mensaje.includes("varios")) {
        Swal.fire({
          icon: 'warning',
          title: 'Límite alcanzado',
          text: mensaje,
          confirmButtonColor: '#F59E0B'
        });
        return;
      }

      // ✔ Caso correcto
      Swal.fire({
        icon: 'success',
        title: 'Solicitud enviada',
        text: mensaje,
        confirmButtonColor: '#3B82F6'
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
