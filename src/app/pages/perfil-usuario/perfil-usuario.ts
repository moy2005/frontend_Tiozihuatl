import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { UserProfileService } from '../../api/services/user-profile.service';

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil-usuario.html',
  styleUrls: ['./perfil-usuario.css']
})
export class PerfilUsuarioComponent implements OnInit {
  user: any = {};
  cargando = false;
  editando = false;
  contrasenaActual = '';
  nuevaContrasena = '';

  constructor(private userService: UserProfileService, private router: Router) {}

  ngOnInit() {
    this.obtenerPerfil();
  }

  /** 🧠 Obtener datos del perfil */
  async obtenerPerfil() {
    this.cargando = true;
    try {
      const res = await this.userService.getProfile().toPromise();
      this.user = res;
    } catch (err: any) {
      Swal.fire('Error', err?.error?.error || 'No se pudo cargar el perfil.', 'error');
      if (err.status === 401) {
        this.router.navigate(['/login']);
      }
    } finally {
      this.cargando = false;
    }
  }

  habilitarEdicion() {
    this.editando = true;
  }

  /** 🧾 Guardar cambios del perfil */
  async guardarCambios() {
    this.cargando = true;
    try {
      const data = {
        nombre: this.user.nombre,
        a_paterno: this.user.a_paterno,
        a_materno: this.user.a_materno,
        correo: this.user.correo,
        telefono: this.user.telefono,
      };
      const res = await this.userService.updateProfile(data).toPromise();
      Swal.fire('Éxito', res?.message || 'Perfil actualizado correctamente.', 'success');
      this.editando = false;
    } catch (err: any) {
      Swal.fire('Error', err?.error?.error || 'Error al actualizar el perfil.', 'error');
    } finally {
      this.cargando = false;
    }
  }

  /** 🔒 Cambiar contraseña */
   async cambiarContrasena() {
    if (!this.contrasenaActual || !this.nuevaContrasena) {
      Swal.fire('Campos incompletos', 'Debes llenar ambas contraseñas.', 'info');
      return;
    }

    if (!this.validarPasswordFuerte()) {
      Swal.fire('Contraseña débil', 'La nueva contraseña no cumple los requisitos mínimos de seguridad.', 'warning');
      return;
    }

    this.cargando = true;
    try {
      const res = await this.userService.changePassword(this.contrasenaActual, this.nuevaContrasena).toPromise();
      Swal.fire('Éxito', res?.message || 'Contraseña actualizada correctamente.', 'success');
      this.contrasenaActual = '';
      this.nuevaContrasena = '';
      this.passwordStage = 0;
      this.showPasswordTip = false;
    } catch (err: any) {
      Swal.fire('Error', err?.error?.error || 'Error al cambiar contraseña.', 'error');
    } finally {
      this.cargando = false;
    }
  }


  /** Mostrar u ocultar campos según rol */
  mostrarCampo(campo: string): boolean {
    const rol = this.user.rol;
    if (!rol) return false;

    switch (rol) {
      case 'Administrador': return true;
      case 'Visitante': return !['matricula', 'carrera', 'semestre'].includes(campo);
      case 'Bibliotecario': return !['carrera', 'semestre'].includes(campo);
      case 'Docente': return campo !== 'semestre';
      case 'Alumno': return true;
      default: return false;
    }
  }

  editable(campo: string): boolean {
    const rol = this.user.rol;
    if (rol === 'Administrador' || rol === 'Visitante') return true;

    // Solo correo y teléfono son editables para otros roles
    if (['correo', 'telefono'].includes(campo)) return true;
    return false;
  }


  /** 🔁 Cerrar sesión */
  cerrarSesion() {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Tu sesión actual se cerrará.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, salir'
    }).then((r) => {
      if (r.isConfirmed) {
        localStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  /** 🚪 Ir al panel admin (solo para Administrador) */
  irPanelAdmin() {
    this.router.navigate(['/admin-panel']);
  }


  passwordStage = 0;
  showPasswordTip = false;

  private uppercaseRegex = /[A-Z]/;
  private lowercaseRegex = /[a-z]/;
  private numberRegex = /\d/;
  private specialCharRegex = /[@$!%*?&]/;

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

  validarPasswordFuerte(): boolean {
    return this.passwordStage === 3;
  }

}
