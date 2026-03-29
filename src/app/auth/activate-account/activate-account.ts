import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../api/services/auth';

type Step = 'verifying' | 'form' | 'success' | 'error';

@Component({
  selector: 'app-activate-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activate-account.html',
  styleUrls: ['./activate-account.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ActivateAccountComponent implements OnInit {
  step: Step = 'verifying';

  token = '';
  nombreUsuario = '';
  identificador = '';
  etiquetaIdentificador = 'Identificador';

  password = '';
  confirm_password = '';
  cargando = false;
  mostrarPassword = false;
  mostrarConfirm = false;

  get passwordsCoinciden(): boolean {
    return this.password === this.confirm_password;
  }

  get passwordValida(): boolean {
    return this.password.length >= 8;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

    if (!this.token) {
      this.step = 'error';
      return;
    }

    this.verificarToken();
  }

  verificarToken() {
    this.step = 'verifying';

    this.auth.verifyActivationToken(this.token).subscribe({
      next: (res) => {
        this.nombreUsuario = `${res.a_paterno} ${res.nombre}`;
        this.identificador = res.identificador || '';
        this.etiquetaIdentificador =
          res.etiquetaIdentificador ||
          (this.identificador.includes('@') ? 'Correo' : 'Matrícula');
        this.step = 'form';
      },
      error: (err) => {
        this.step = 'error';
        console.error('Token inválido:', err?.error?.error);
      },
    });
  }

  activarCuenta() {
    if (!this.passwordValida) {
      Swal.fire('Contraseña corta', 'La contraseña debe tener al menos 8 caracteres.', 'warning');
      return;
    }

    if (!this.passwordsCoinciden) {
      Swal.fire('Error', 'Las contraseñas no coinciden.', 'warning');
      return;
    }

    this.cargando = true;

    this.auth.activateAccount({
      token: this.token,
      password: this.password,
      confirm_password: this.confirm_password,
    }).subscribe({
      next: () => {
        this.step = 'success';
      },
      error: (err) => {
        Swal.fire('Error', err?.error?.error || 'No se pudo activar la cuenta.', 'error');
        this.cargando = false;
      },
    });
  }

  irAlLogin() {
    this.router.navigate(['/login']);
  }
}
