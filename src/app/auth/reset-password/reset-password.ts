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
  confirmPassword = '';
  cargando = false;
  tokenValido: boolean | null = null;

  // ✅ Propiedades para validación de contraseña
  passwordStage = 0;
  showPasswordTip = false;
  mostrarContrasena = false;
  mostrarConfirmPassword = false;

  private uppercaseRegex = /[A-Z]/;
  private lowercaseRegex = /[a-z]/;
  private numberRegex = /\d/;
  private specialCharRegex = /[@$!%*?&]/;

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

  // ✅ Métodos de validación
  hasUppercase(): boolean {
    return this.uppercaseRegex.test(this.nuevaContrasena);
  }

  hasLowercase(): boolean {
    return this.lowercaseRegex.test(this.nuevaContrasena);
  }

  hasNumber(): boolean {
    return this.numberRegex.test(this.nuevaContrasena);
  }

  hasSpecialChar(): boolean {
    return this.specialCharRegex.test(this.nuevaContrasena);
  }

  // ✅ Sanitización XSS
  sanitizeInput(value: string): string {
    if (!value) return '';
    
    return value
      .replace(/[<>]/g, '')
      .replace(/['"]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/script/gi, '')
      .trim();
  }

  bloquearCaracteresPeligrosos(event: KeyboardEvent) {
    const caracteresProhibidos = ['<', '>', '"', "'", '`'];
    
    if (caracteresProhibidos.includes(event.key)) {
      event.preventDefault();
    }
  }

  // Bloquear paste si excede 8 caracteres
  onPastePassword(event: ClipboardEvent) {
    const pasted = event.clipboardData?.getData('text') || '';
    const max = 8;

    if (pasted.length > max) {
      event.preventDefault();
      Swal.fire({
        icon: 'warning',
        text: `La contraseña solo puede tener máximo ${max} caracteres.`,
        timer: 1500,
        showConfirmButton: false
      });
    }
  }

  // ✅ Validación en tiempo real
  onPasswordInput() {
    this.nuevaContrasena = this.sanitizeInput(this.nuevaContrasena);
    const pass = this.nuevaContrasena;
    this.showPasswordTip = true;
    
    if (!pass) {
      this.passwordStage = 0;
      return;
    }

    const hasLower = this.hasLowercase();
    const hasUpper = this.hasUppercase();
    const hasNumber = this.hasNumber();
    const hasSymbol = this.hasSpecialChar();
    const minLength = pass.length >= 8;

    const score = [hasLower, hasUpper, hasNumber, hasSymbol, minLength].filter(Boolean).length;
    this.passwordStage = score <= 2 ? 1 : score === 3 || score === 4 ? 2 : 3;
  }

  // ✅ Toggle mostrar/ocultar
  toggleMostrarContrasena() {
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  toggleMostrarConfirmPassword() {
    this.mostrarConfirmPassword = !this.mostrarConfirmPassword;
  }

  // ✅ Validar contraseña fuerte
  validarPasswordFuerte(): boolean {
    return this.passwordStage === 3 && this.nuevaContrasena === this.confirmPassword;
  }

  irAForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  irALogin() {
    this.router.navigate(['/login']);
  }

  async restablecer() {
    // ✅ Sanitizar
    this.nuevaContrasena = this.sanitizeInput(this.nuevaContrasena);
    this.confirmPassword = this.sanitizeInput(this.confirmPassword);

    if (!this.nuevaContrasena) {
      Swal.fire('Datos incompletos', 'Ingresa una nueva contraseña.', 'info');
      return;
    }

    // ✅ Validar que coincidan
    if (this.nuevaContrasena !== this.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Las contraseñas no coinciden',
        text: 'Por favor verifica que ambas contraseñas sean iguales.',
        confirmButtonColor: '#E53E3E',
      });
      return;
    }

    // ✅ Validar que sea fuerte
    if (!this.validarPasswordFuerte()) {
      Swal.fire({
        icon: 'warning',
        title: 'Contraseña débil',
        text: 'La contraseña debe cumplir con todos los requisitos de seguridad.',
        confirmButtonColor: '#F59E0B',
      });
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