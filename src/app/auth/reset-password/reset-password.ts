import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../api/services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class ResetPasswordComponent {

  token: string = '';
  nuevaContrasena = '';
  cargando = false;
  tokenValido: boolean | null = null; // null = cargando, true = OK, false = inválido

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'];

    if (!this.token) {
      this.tokenValido = false;
      return;
    }

    try {
      const res: any = await this.auth.validateToken(this.token).toPromise();
      this.tokenValido = res?.valid === true;
    } catch (err) {
      this.tokenValido = false;
    }
  }

  irAForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  irALogin() {
    this.router.navigate(['/login']);
  }

  async restablecer() {
    if (!this.nuevaContrasena) {
      Swal.fire('Datos incompletos', 'Ingresa una nueva contraseña.', 'info');
      return;
    }

    this.cargando = true;
    try {
      const res: any = await this.auth
        .resetPassword({ token: this.token, nuevaContrasena: this.nuevaContrasena })
        .toPromise();

      Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: res?.message || 'Tu contraseña ha sido restablecida correctamente.',
        confirmButtonColor: '#16A34A'
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
