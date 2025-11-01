import { Component } from '@angular/core';
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
})
export class ForgotPasswordComponent {
  correo = '';
  codigo = '';
  nuevaContrasena = '';
  modoRecuperacion = false; // false = enviar correo, true = reset con token
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
      const res: any = await this.auth.forgotPassword({ correo: this.correo }).toPromise();
      Swal.fire({
        icon: 'success',
        title: 'Correo enviado',
        text: res?.message || 'Revisa tu bandeja de entrada para continuar.',
        confirmButtonColor: '#3B82F6',
      });
      this.modoRecuperacion = true;
    } catch (err: any) {
      const msg = err?.error?.error || 'Error al enviar el correo de recuperación.';
      Swal.fire('Error', msg, 'error');
    } finally {
      this.cargando = false;
    }
  }

  async restablecerContrasena() {
    if (!this.codigo || !this.nuevaContrasena) {
      Swal.fire('Datos incompletos', 'Ingresa el código y la nueva contraseña.', 'info');
      return;
    }

    this.cargando = true;
    try {
      const res: any = await this.auth
        .resetPassword({
          codigo: this.codigo,
          nuevaContrasena: this.nuevaContrasena,
        })
        .toPromise();

      Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: res?.message || 'Tu contraseña ha sido restablecida correctamente.',
        confirmButtonColor: '#16A34A',
      });

      this.router.navigate(['/login']);
    } catch (err: any) {
      const msg = err?.error?.error || 'Error al restablecer la contraseña.';
      Swal.fire('Error', msg, 'error');
    } finally {
      this.cargando = false;
    }
  }
}
