import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { UserProfileService } from '../../api/services/user-profile.service';
import { AuthService } from '../../api/services/auth';

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil-usuario.html',
  styleUrls: ['./perfil-usuario.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class PerfilUsuarioComponent implements OnInit {
  readonly palabraSecretaMaxLength = 10;
  user: any = {};
  cargando = true;
  editando = false;
  editandoPalabraSecreta = false;
  contrasenaActual = '';
  nuevaContrasena = '';
  palabraSecreta = '';
  mostrarPalabraSecreta = false;

  passwordStage = 0;
  showPasswordTip = false;

  private uppercaseRegex = /[A-Z]/;
  private lowercaseRegex = /[a-z]/;
  private numberRegex = /\d/;
  private specialCharRegex = /[@$!%*?&]/;

  constructor(
    private userService: UserProfileService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.obtenerPerfil();
  }

  get rolNormalizado(): string {
    return String(this.user?.rol || '').trim().toLowerCase();
  }

  get esVisitante(): boolean {
    return this.rolNormalizado === 'visitante';
  }

  get esAdministrador(): boolean {
    return this.rolNormalizado === 'administrador';
  }

  get iconoPorRol(): string {
    switch (this.rolNormalizado) {
      case 'administrador':
        return 'ph ph-user';
      case 'docente':
        return 'ph ph-chalkboard-teacher';
      case 'bibliotecario':
        return 'ph ph-books';
      case 'estudiante':
        return 'ph ph-student';
      case 'visitante':
        return 'ph ph-user';
      default:
        return 'ph ph-user';
    }
  }

  get subtituloHero(): string {
    if (this.rolNormalizado === 'estudiante') {
      return this.user.matricula ? `Matricula: ${this.user.matricula}` : 'Matricula pendiente';
    }

    return this.user.correo ? `Correo: ${this.user.correo}` : 'Perfil de usuario';
  }

  get tienePalabraSecreta(): boolean {
    return !!this.user?.tiene_palabra_secreta;
  }

  async obtenerPerfil() {
    this.cargando = true;
    try {
      const res = await this.userService.getProfile().toPromise();
      this.user = res;
      this.editandoPalabraSecreta = false;
      this.limpiarPalabraSecreta();
    } catch (err: any) {
      Swal.fire('Error', err?.error?.error || 'No se pudo cargar el perfil.', 'error');
      if (err.status === 401 || err.status === 403) {
        this.router.navigate(['/login']);
      }
    } finally {
      this.cargando = false;
    }
  }

  habilitarEdicion() {
    this.editando = true;
  }

  cancelarEdicion() {
    this.editando = false;
    this.obtenerPerfil();
  }

  habilitarEdicionPalabraSecreta() {
    this.editandoPalabraSecreta = true;
    this.limpiarPalabraSecreta();
  }

  cancelarEdicionPalabraSecreta() {
    this.editandoPalabraSecreta = false;
    this.limpiarPalabraSecreta();
  }

  async guardarCambios() {
    const palabraSecreta = this.palabraSecreta.trim();

    if (
      palabraSecreta &&
      (palabraSecreta.length < 4 || palabraSecreta.length > this.palabraSecretaMaxLength)
    ) {
      Swal.fire(
        'Dato invalido',
        `La palabra secreta debe tener entre 4 y ${this.palabraSecretaMaxLength} caracteres.`,
        'info'
      );
      return;
    }

    this.cargando = true;
    try {
      const data: any = {
        nombre: this.user.nombre,
        a_paterno: this.user.a_paterno,
        a_materno: this.user.a_materno,
        correo: this.user.correo,
        telefono: this.user.telefono,
      };

      if (palabraSecreta) {
        data.palabra_secreta = palabraSecreta;
      }

      const res = await this.userService.updateProfile(data).toPromise();
      Swal.fire('Exito', res?.message || 'Perfil actualizado correctamente.', 'success');
      this.editando = false;
      if (palabraSecreta) {
        this.user.tiene_palabra_secreta = true;
      }
      this.editandoPalabraSecreta = false;
      this.limpiarPalabraSecreta();
    } catch (err: any) {
      Swal.fire('Error', this.obtenerMensajeAmigable(err, 'Error al actualizar el perfil.'), 'error');
    } finally {
      this.cargando = false;
    }
  }

  async guardarPalabraSecreta() {
    const palabraSecreta = this.palabraSecreta.trim();

    if (!palabraSecreta) {
      Swal.fire('Campo requerido', 'Escribe una palabra secreta para guardarla.', 'info');
      return;
    }

    if (palabraSecreta.length < 4 || palabraSecreta.length > this.palabraSecretaMaxLength) {
      Swal.fire(
        'Dato invalido',
        `La palabra secreta debe tener entre 4 y ${this.palabraSecretaMaxLength} caracteres.`,
        'info'
      );
      return;
    }

    this.cargando = true;
    try {
      const res = await this.userService
        .updateProfile({ palabra_secreta: palabraSecreta })
        .toPromise();

      Swal.fire('Exito', res?.message || 'Palabra secreta actualizada correctamente.', 'success');
      this.user.tiene_palabra_secreta = true;
      this.editandoPalabraSecreta = false;
      this.limpiarPalabraSecreta();
    } catch (err: any) {
      Swal.fire('Error', this.obtenerMensajeAmigable(err, 'Error al actualizar la palabra secreta.'), 'error');
    } finally {
      this.cargando = false;
    }
  }

  async cambiarContrasena() {
    if (!this.contrasenaActual || !this.nuevaContrasena) {
      Swal.fire('Campos incompletos', 'Debes llenar ambas contrasenas.', 'info');
      return;
    }

    this.cargando = true;
    try {
      const res = await this.userService
        .changePassword(this.contrasenaActual, this.nuevaContrasena)
        .toPromise();
      Swal.fire('Exito', res?.message || 'Contrasena actualizada correctamente.', 'success');
      this.contrasenaActual = '';
      this.nuevaContrasena = '';
    } catch (err: any) {
      Swal.fire('Error', err?.error?.error || 'Error al cambiar contrasena.', 'error');
    } finally {
      this.cargando = false;
    }
  }

  async eliminarCuentaVisitante() {
    if (!this.esVisitante) {
      Swal.fire('Accion no permitida', 'Solo las cuentas de visitante pueden eliminarse desde el perfil.', 'info');
      return;
    }

    const confirmacion = await Swal.fire({
      title: 'Eliminar cuenta permanentemente?',
      html: `
        <div style="text-align:left; line-height:1.55;">
          <p>Esta accion es permanente y no se puede deshacer.</p>
          <p>Se eliminaran tu cuenta y los datos relacionados, como carrito, progreso, compras y sesiones.</p>
          <p><strong>Para continuar escribe ELIMINAR</strong></p>
        </div>
      `,
      icon: 'warning',
      input: 'text',
      inputPlaceholder: 'Escribe ELIMINAR',
      showCancelButton: true,
      confirmButtonColor: '#B42318',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Eliminar mi cuenta',
      cancelButtonText: 'Cancelar',
      focusCancel: true,
      preConfirm: (valor) => {
        if ((valor || '').trim().toUpperCase() !== 'ELIMINAR') {
          Swal.showValidationMessage('Debes escribir ELIMINAR para confirmar.');
          return false;
        }

        return true;
      }
    });

    if (!confirmacion.isConfirmed) return;

    this.cargando = true;
    try {
      const res = await this.userService.deleteAccount().toPromise();
      this.authService.clearSession();

      await Swal.fire(
        'Cuenta eliminada',
        res?.message || 'Tu cuenta fue eliminada correctamente.',
        'success'
      );

      this.router.navigate(['/inicio']);
    } catch (err: any) {
      Swal.fire('Error', this.obtenerMensajeAmigable(err, 'No fue posible eliminar la cuenta.'), 'error');
    } finally {
      this.cargando = false;
    }
  }

  mostrarCampo(campo: string): boolean {
    const rol = this.rolNormalizado;
    if (!rol) return false;

    if (rol === 'estudiante') {
      return true;
    }

    return !['matricula', 'carrera', 'semestre', 'grupo'].includes(campo);
  }

  editable(campo: string): boolean {
    const rol = this.rolNormalizado;
    if (rol === 'administrador' || rol === 'visitante') return true;
    return ['correo', 'telefono'].includes(campo);
  }

  cerrarSesion() {
    Swal.fire({
      title: 'Cerrar sesion?',
      text: 'Tu sesion actual se cerrara.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Si, salir'
    }).then((r) => {
      if (r.isConfirmed) {
        localStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  irPanelAdmin() {
    this.router.navigate(['/admin']);
  }

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

  onPasswordInput() {
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

  onPalabraSecretaInput(event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const sanitized = input.value.slice(0, this.palabraSecretaMaxLength);
    if (sanitized !== this.palabraSecreta) {
      this.palabraSecreta = sanitized;
    }

    if (input.value !== sanitized) {
      input.value = sanitized;
    }
  }

  onPalabraSecretaPaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData('text') || '';
    if (!pastedText) return;

    const input = event.target as HTMLInputElement | null;
    const currentValue = this.palabraSecreta || '';
    const selectionStart = input?.selectionStart ?? currentValue.length;
    const selectionEnd = input?.selectionEnd ?? currentValue.length;

    const nextValue =
      currentValue.slice(0, selectionStart) +
      pastedText +
      currentValue.slice(selectionEnd);

    if (nextValue.length <= this.palabraSecretaMaxLength) {
      return;
    }

    event.preventDefault();
    Swal.fire(
      'Limite alcanzado',
      `La palabra secreta no puede exceder ${this.palabraSecretaMaxLength} caracteres.`,
      'info'
    );
  }

  validarPasswordFuerte(): boolean {
    return this.passwordStage === 3;
  }

  private limpiarPalabraSecreta() {
    this.palabraSecreta = '';
    this.mostrarPalabraSecreta = false;
  }

  private obtenerMensajeAmigable(err: any, fallback: string): string {
    const mensaje = String(err?.error?.error || err?.message || '').trim();

    if (!mensaje) return fallback;

    if (mensaje.includes('Duplicate entry')) {
      if (mensaje.includes('correo') || mensaje.includes('UQ_Usuarios_correo')) {
        return 'Ese correo electronico ya esta registrado en otra cuenta.';
      }

      if (mensaje.includes('telefono')) {
        return 'Ese numero de telefono ya esta registrado en otra cuenta.';
      }

      if (mensaje.includes('matricula')) {
        return 'Esa matricula ya esta registrada en otra cuenta.';
      }

      return 'Uno de los datos capturados ya esta registrado en otra cuenta.';
    }

    if (mensaje.includes('Solo las cuentas de tipo Visitante')) {
      return 'Solo las cuentas de visitante pueden eliminarse desde el perfil.';
    }

    return mensaje;
  }
}
