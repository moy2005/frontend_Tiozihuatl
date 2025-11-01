import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AdminUserService } from '../../../api/services/admin-user.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.css'],
})
export class AdminPanelComponent implements OnInit {
  usuarios: any[] = [];
  roles: any[] = [];
  carreras: any[] = [];
  semestres: any[] = [];

  cargando = false;
  editando = false;
  nuevoUsuario: any = this.resetForm();

  constructor(
    private adminService: AdminUserService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarUsuarios();
    this.cargarRoles();
    this.cargarCatalogos();
  }

  resetForm() {
    return {
      id_usuario: null,
      nombre: '',
      a_paterno: '',
      a_materno: '',
      correo: '',
      telefono: '',
      contrasena: '',
      matricula: '',
      id_rol: '',
      id_carrera: '',
      id_semestre: '',
      estado: 'Activo',
    };
  }

  /** ===========================
   * 🔁 Cambiar estado (activar / desactivar)
   * =========================== */
  cambiarEstado(usuario: any, nuevoEstado: 'Activo' | 'Inactivo') {
    const accion = nuevoEstado === 'Activo' ? 'activar' : 'desactivar';

    Swal.fire({
      title: `¿Deseas ${accion} a este usuario?`,
      text: `El usuario pasará a estado ${nuevoEstado}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: nuevoEstado === 'Activo' ? '#16A34A' : '#E53E3E',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Sí, ${accion}`,
    }).then((r) => {
      if (r.isConfirmed) {
        const payload = { estado: nuevoEstado };
        this.adminService.update(usuario.id_usuario, payload).subscribe({
          next: () => {
            Swal.fire(
              'Hecho',
              `Usuario ${nuevoEstado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`,
              'success'
            );
            this.cargarUsuarios();
          },
          error: (err) =>
            Swal.fire('Error', err?.error?.error || 'No se pudo actualizar el estado.', 'error'),
        });
      }
    });
  }

  /** ===========================
   * 🔄 Cargar datos iniciales
   * =========================== */
  cargarUsuarios() {
    this.cargando = true;
    this.adminService.getAll().subscribe({
      next: (res) => (this.usuarios = res),
      error: () => Swal.fire('Error', 'No se pudieron cargar los usuarios.', 'error'),
      complete: () => (this.cargando = false),
    });
  }

  cargarRoles() {
    this.adminService.getRoles().subscribe({
      next: (res) => (this.roles = res),
      error: (err) => console.error('Error al obtener roles', err),
    });
  }

  cargarCatalogos() {
    this.adminService.getCarreras().subscribe({
      next: (res) => (this.carreras = res),
      error: (err) => console.error('❌ Error al obtener carreras:', err),
    });

    this.adminService.getSemestres().subscribe({
      next: (res) => (this.semestres = res),
      error: (err) => console.error('❌ Error al obtener semestres:', err),
    });
  }

  /** ===========================
   * 🧩 Control dinámico de campos
   * =========================== */
  campoActivo(campo: string): boolean {
    const rol = this.getRolNombre(this.nuevoUsuario.id_rol);
    if (!rol) return true; // todos activos antes de elegir rol

    switch (rol) {
      case 'Administrador':
        return true; // todos los campos activos

      case 'Alumno':
        // todo activo
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','matricula','id_carrera','id_semestre','estado'].includes(campo);

      case 'Docente':
        // sin semestre
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','matricula','id_carrera','estado'].includes(campo);

      case 'Bibliotecario':
        // sin carrera ni semestre
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','matricula','estado'].includes(campo);

      case 'Visitante':
        // sin matrícula, carrera ni semestre
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','estado'].includes(campo);

      default:
        return true;
    }
  }

  getRolNombre(id_rol: number): string {
    const rol = this.roles.find((r) => r.id_rol === Number(id_rol));
    return rol ? rol.nombre_rol : '';
  }

  /** ===========================
   * 💾 Guardar o Editar usuario
   * =========================== */
  guardarUsuario() {
    const user = this.nuevoUsuario;
    const isEdit = !!user.id_usuario;
    const rol = this.getRolNombre(user.id_rol);

    if (!user.nombre || !user.correo || !user.id_rol) {
      Swal.fire('Campos incompletos', 'Nombre, correo y rol son obligatorios.', 'info');
      return;
    }

    // Validaciones por rol
    if (rol === 'Administrador') {
      // Todo permitido
    }
    else if (rol === 'Alumno') {
      if (!user.id_carrera || !user.id_semestre || !user.matricula || !user.telefono) {
        Swal.fire('Campos requeridos', 'Alumno debe tener carrera, semestre, matrícula y teléfono.', 'info');
        return;
      }
    }
    else if (rol === 'Docente') {
      if (!user.id_carrera || !user.matricula || !user.telefono) {
        Swal.fire('Campos requeridos', 'Docente debe tener carrera, matrícula y teléfono.', 'info');
        return;
      }
      user.id_semestre = null; // no aplica semestre
    }
    else if (rol === 'Bibliotecario') {
      if (!user.matricula || !user.telefono) {
        Swal.fire('Campos requeridos', 'Bibliotecario debe tener matrícula y teléfono.', 'info');
        return;
      }
      user.id_carrera = null;
      user.id_semestre = null;
    }
    else if (rol === 'Visitante') {
      // visitante no tiene matrícula, carrera ni semestre
      user.id_carrera = null;
      user.id_semestre = null;
      user.matricula = null;
    }

    const request = isEdit
      ? this.adminService.update(user.id_usuario, user)
      : this.adminService.create(user);

    request.subscribe({
      next: (res) => {
        Swal.fire('Éxito', res.message || 'Operación exitosa.', 'success');
        this.nuevoUsuario = this.resetForm();
        this.editando = false;
        this.cargarUsuarios();
      },
      error: (err) =>
        Swal.fire('Error', err?.error?.error || 'No se pudo guardar.', 'error'),
    });
  }

  /** ===========================
   * ✏️ Editar o volver
   * =========================== */
  editarUsuario(u: any) {
    this.nuevoUsuario = { ...u };
    this.editando = true;
  }

  volverAlPerfil() {
    this.router.navigate(['/perfil']);
  }
}
