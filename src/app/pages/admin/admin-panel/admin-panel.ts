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

  /** 🔄 Cargar datos */
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
    next: (res) => {
      console.log('✅ Carreras:', res);
      this.carreras = res;
    },
    error: (err) => console.error('❌ Error al obtener carreras:', err),
  });

  this.adminService.getSemestres().subscribe({
    next: (res) => {
      console.log('✅ Semestres:', res);
      this.semestres = res;
    },
    error: (err) => console.error('❌ Error al obtener semestres:', err),
  });
}

  /** 🧩 Verifica si el campo aplica según rol */
  campoActivo(campo: string): boolean {
    const rol = this.getRolNombre(this.nuevoUsuario.id_rol);
    if (!rol) return false;

    switch (campo) {
      case 'matricula':
      case 'semestre':
      case 'carrera':
        if (rol === 'Alumno') return true;
        if (rol === 'Docente' && campo === 'carrera') return true;
        return false;
      default:
        return true;
    }
  }

  getRolNombre(id_rol: number): string {
    const rol = this.roles.find((r) => r.id_rol === Number(id_rol));
    return rol ? rol.nombre_rol : '';
  }

  /** 🧾 Guardar o editar */
  guardarUsuario() {
    const user = this.nuevoUsuario;
    const isEdit = !!user.id_usuario;
    const rol = this.getRolNombre(user.id_rol);

    if (!user.nombre || !user.correo || !user.id_rol) {
      Swal.fire('Campos incompletos', 'Nombre, correo y rol son obligatorios.', 'info');
      return;
    }

    // Validaciones por rol
    if (rol === 'Alumno') {
      if (!user.id_carrera || !user.id_semestre || !user.matricula || !user.telefono) {
        Swal.fire('Campos requeridos', 'Alumno debe tener carrera, semestre, matrícula y teléfono.', 'info');
        return;
      }
    } else if (rol === 'Docente') {
      if (!user.id_carrera) {
        Swal.fire('Campos requeridos', 'Docente debe tener carrera.', 'info');
        return;
      }
      user.id_semestre = null;
      user.matricula = null;
    } else {
      // Bibliotecario o Visitante
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

  editarUsuario(u: any) {
    this.nuevoUsuario = { ...u };
    this.editando = true;
  }

  desactivarUsuario(id: number) {
    Swal.fire({
      title: '¿Desactivar usuario?',
      text: 'El usuario pasará a estado inactivo.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E53E3E',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, desactivar',
    }).then((r) => {
      if (r.isConfirmed) {
        this.adminService.delete(id).subscribe({
          next: (res) => {
            Swal.fire('Hecho', res.message || 'Usuario desactivado.', 'success');
            this.cargarUsuarios();
          },
          error: (err) =>
            Swal.fire('Error', err?.error?.error || 'No se pudo desactivar.', 'error'),
        });
      }
    });
  }

  volverAlPerfil() {
    this.router.navigate(['/perfil']);
  }

  
}
