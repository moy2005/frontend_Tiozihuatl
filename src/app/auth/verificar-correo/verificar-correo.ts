import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../api/services/auth';

type VerificationState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verificar-correo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verificar-correo.html',
  styleUrls: ['./verificar-correo.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class VerificarCorreoComponent implements OnInit {
  estado: VerificationState = 'loading';
  mensaje = 'Estamos validando tu enlace de verificación.';
  correo = '';

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.mostrarError('El enlace no contiene un token de verificación.');
      return;
    }

    this.verificar(token);
  }

  verificar(token: string) {
    this.auth.verifyEmailLink(token).subscribe({
      next: (response: any) => {
        this.correo = String(response?.correo || '').trim();
        if (this.correo && isPlatformBrowser(this.platformId)) {
          localStorage.setItem('correoPreRegistro', this.correo);
        }

        this.estado = 'success';
        this.mensaje =
          'Tu correo quedó confirmado. Ya puedes completar la seguridad de tu cuenta de visitante.';
      },
      error: (error) => {
        this.mostrarError(
          error?.error?.error ||
            'El enlace no es válido, ya fue utilizado o ha expirado.'
        );
      },
    });
  }

  continuarRegistro() {
    this.router.navigate(['/register'], {
      queryParams: {
        skip: '1',
        ...(this.correo ? { correo: this.correo } : {}),
      },
    });
  }

  volverARegistro() {
    this.router.navigate(['/register']);
  }

  irALogin() {
    this.router.navigate(['/login']);
  }

  private mostrarError(mensaje: string) {
    this.estado = 'error';
    this.mensaje = mensaje;
  }
}
