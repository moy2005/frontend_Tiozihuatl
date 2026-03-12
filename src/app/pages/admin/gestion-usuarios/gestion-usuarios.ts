import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AdminUserService } from '../../../api/services/admin-user.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-usuarios.html',
  styleUrls: ['./gestion-usuarios.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class GestionUsuariosComponent implements OnInit {

  // ── Datos ──────────────────────────────────────────────────
  usuarios: any[] = [];
  roles: any[] = [];
  carreras: any[] = [];
  semestres: any[] = [];
  periodos: any[] = [];    
periodosActivos: any[] = []; // solo activos — para crear/importar

  // ── Estado UI ──────────────────────────────────────────────
  cargando = false;
  editando = false;
  nuevoUsuario: any = this.resetForm();
  nuevaContrasena = '';
  mostrarModal = false;
  mostrarDetalles = false;
  usuarioSeleccionado: any = null;

  // ── Importación ────────────────────────────────────────────
  mostrarModalImportacion = false;
  cargandoImport = false;
  archivoSeleccionado: File | null = null;
  resultadoImportacion: any = null;
  importData: any = { id_rol: '', id_carrera: '', id_semestre: '', grupo: '', id_periodo: '' }; // ✅ CAMBIO: añadido id_periodo
  esAlumnoImport = false;

  // ── Filtros avanzados ──────────────────────────────────────
  mostrarFiltros = false;
  filtros: any = {
    rol: '',
    id_carrera: '',
    id_semestre: '',
    grupo: '',
    id_periodo: ''
  };
  filtrosActivos = false;
  semestresFiltro: any[] = [];   // ← nuevo
gruposFiltro: string[] = [];   // ← nuevo

// ── Avanzar semestre ───────────────────────────────────────────
mostrarModalAvanzar = false;
pasoAvanzar = 1;
cargandoAvanzar = false;
cargandoPreview = false;
alumnosParaAvance: any[] = [];
avanzarData: any = {
  id_periodo_origen: '',
  id_periodo_destino: ''
};


  // ── Paginación ─────────────────────────────────────────────
paginaActual = 1;
itemsPorPagina = 15;
totalPaginas = 0;
filtrosExpandidos = false; // Para controlar visibilidad de filtros en móvil
Math = Math; // Para usar en el template



  constructor(
    private adminService: AdminUserService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarUsuarios();
    this.cargarRoles();
    this.cargarCatalogos();
    this.cargarPeriodosActivos();
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
      grupo: '',
      id_rol: '',
      id_carrera: '',
      id_semestre: '',
      id_periodo: '', // ✅ CAMBIO: añadido
      estado: 'Activo',
    };
  }

  onPeriodoFiltroChange() {
  // Resetear semestre y grupo al cambiar periodo
  this.filtros.id_semestre = '';
  this.filtros.grupo = '';
  this.semestresFiltro = [];
  this.gruposFiltro = [];

  if (!this.filtros.id_periodo) {
    // Sin periodo: volver a los catálogos completos
    this.semestresFiltro = this.semestres;
    this.gruposFiltro = ['A', 'B'];
    this.aplicarFiltros();
    return;
  }

  this.adminService.getOpcionesPorPeriodo(this.filtros.id_periodo).subscribe({
    next: (res) => {
      this.semestresFiltro = res.semestres;
      this.gruposFiltro = res.grupos;
      this.aplicarFiltros();
    },
    error: (err) => console.error('❌ Error al cargar opciones del periodo:', err)
  });
}


  get usuariosPaginados() {
  const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
  const fin = inicio + this.itemsPorPagina;
  return this.usuarios.slice(inicio, fin);
}

// ── Métodos de paginación ──────────────────────────────────

calcularTotalPaginas() {
  this.totalPaginas = Math.ceil(this.usuarios.length / this.itemsPorPagina);
  if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) {
    this.paginaActual = this.totalPaginas;
  }
}

get paginas(): (number | string)[] {
  this.calcularTotalPaginas();
  const total = this.totalPaginas;
  const actual = this.paginaActual;
  const delta = 2; // Número de páginas a mostrar a cada lado
  const rango: number[] = [];
  const rangoConPuntos: (number | string)[] = [];

  for (let i = 1; i <= total; i++) {
    if (
      i === 1 || 
      i === total || 
      (i >= actual - delta && i <= actual + delta)
    ) {
      rango.push(i);
    }
  }

  let previo: number | null = null;
  for (const i of rango) {
    if (previo && i - previo !== 1) {
      rangoConPuntos.push('...');
    }
    rangoConPuntos.push(i);
    previo = i;
  }

  return rangoConPuntos;
}

irAPagina(pagina: number | string) {
  if (typeof pagina === 'number') {
    this.paginaActual = pagina;
  }
}

paginaAnterior() {
  if (this.paginaActual > 1) {
    this.paginaActual--;
  }
}

paginaSiguiente() {
  if (this.paginaActual < this.totalPaginas) {
    this.paginaActual++;
  }
}

cambiarItemsPorPagina() {
  this.paginaActual = 1;
  this.calcularTotalPaginas();
}

toggleFiltros() {
  this.filtrosExpandidos = !this.filtrosExpandidos;
}

  // ── Carga de datos ─────────────────────────────────────────

cargarUsuarios() {
  this.cargando = true;
  this.adminService.getAll().subscribe({
    next: (res) => {
      this.usuarios = res;
      this.calcularTotalPaginas();
    },
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
    next: (res) => {
      this.semestres = res;
      this.semestresFiltro = res; // ← inicializar con todos
    },
    error: (err) => console.error('❌ Error al obtener semestres:', err),
  });

  // Grupos por defecto
  this.gruposFiltro = ['A', 'B'];
}

cargarPeriodosActivos() {
  // Todos los periodos para filtros y avanzar semestre
  this.adminService.getPeriodosTodos().subscribe({
    next: (res) => {
      this.periodos = Array.isArray(res) ? res : (res ? [res] : []);
    },
    error: (err) => console.error('❌ Error al obtener periodos:', err),
  });

  // Solo activos para crear/importar alumnos
  this.adminService.getPeriodosActivos().subscribe({
    next: (res) => {
      this.periodosActivos = Array.isArray(res) ? res : (res ? [res] : []);
    },
    error: (err) => console.error('❌ Error al obtener periodos activos:', err),
  });
}

  // ── Filtros avanzados ──────────────────────────────────────

  abrirFiltros() {
    this.mostrarFiltros = true;
  }

  cerrarFiltros() {
    this.mostrarFiltros = false;
  }

aplicarFiltros() {
  const hayFiltro = Object.values(this.filtros).some(v => v !== '');
  if (!hayFiltro) {
    this.limpiarFiltros();
    return;
  }

  this.cargando = true;
  this.filtrosActivos = true;
  this.paginaActual = 1; // Resetear a primera página

  this.adminService.getFiltered(this.filtros).subscribe({
    next: (res) => {
      this.usuarios = res;
      this.cargando = false;
      this.calcularTotalPaginas();
    },
    error: () => {
      Swal.fire('Error', 'No se pudieron aplicar los filtros.', 'error');
      this.cargando = false;
    }
  });
}

limpiarFiltros() {
  this.filtros = { rol: '', id_carrera: '', id_semestre: '', grupo: '', id_periodo: '' };
  this.filtrosActivos = false;
  this.paginaActual = 1; // Resetear a primera página
  this.cargarUsuarios();
}

  get rolFiltroNombre(): string {
    return this.getRolNombre(this.filtros.id_rol) || '';
  }

  get filtroPorPeriodo(): boolean {
    return !!this.filtros.id_periodo;
  }

  // ── Avanzar semestre ───────────────────────────────────────

abrirModalAvanzar() {
  this.avanzarData = { id_periodo_origen: '', id_periodo_destino: '' };
  this.alumnosParaAvance = [];
  this.pasoAvanzar = 1;
  this.mostrarModalAvanzar = true;
}

cerrarModalAvanzar() {
  this.mostrarModalAvanzar = false;
  this.pasoAvanzar = 1;
  this.alumnosParaAvance = [];
}

cargarPreviewAvance() {
  if (!this.avanzarData.id_periodo_origen) return;
  this.cargandoPreview = true;

  this.adminService.getPreviewAvance(this.avanzarData.id_periodo_origen).subscribe({
    next: (res) => {
      this.alumnosParaAvance = res.map(a => ({ ...a, accion: 'AVANZAR' }));
      this.cargandoPreview = false;
      this.pasoAvanzar = 2;
    },
    error: () => {
      this.cargandoPreview = false;
      Swal.fire('Error', 'No se pudieron cargar los alumnos del periodo.', 'error');
    }
  });
}

countAccion(accion: string): number {
  return this.alumnosParaAvance.filter(a => a.accion === accion).length;
}

toggleTodosAvanzar(accion: string) {
  this.alumnosParaAvance.forEach(a => a.accion = accion);
}

  ejecutarAvanzarSemestre() {
  const avanzar = this.countAccion('AVANZAR');
  const repetir = this.countAccion('REPETIR');
  const baja    = this.countAccion('BAJA');

  const periodoOrigenNombre = this.periodos.find(p => p.id_periodo == this.avanzarData.id_periodo_origen)?.nombre || `#${this.avanzarData.id_periodo_origen}`;
  const periodoDestinoNombre = this.periodos.find(p => p.id_periodo == this.avanzarData.id_periodo_destino)?.nombre || `#${this.avanzarData.id_periodo_destino}`;

  Swal.fire({
    title: '¿Confirmar proceso?',
    html: `
      <div style="text-align:left; font-size:0.875rem;">
        <p><strong>Origen:</strong> ${periodoOrigenNombre}</p>
        <p><strong>Destino:</strong> ${periodoDestinoNombre}</p>
        <hr style="margin: 0.75rem 0;">
<p style="display:flex; align-items:center; gap:0.5rem; margin:0.35rem 0;">
  <ion-icon name="arrow-up-circle-outline" style="font-size:1.1rem; color:#16A34A;"></ion-icon>
  <strong>${avanzar}</strong> alumnos avanzan de semestre
</p>
<p style="display:flex; align-items:center; gap:0.5rem; margin:0.35rem 0;">
  <ion-icon name="refresh-circle-outline" style="font-size:1.1rem; color:#D97706;"></ion-icon>
  <strong>${repetir}</strong> alumnos repiten
</p>
<p style="display:flex; align-items:center; gap:0.5rem; margin:0.35rem 0;">
  <ion-icon name="remove-circle-outline" style="font-size:1.1rem; color:#DC2626;"></ion-icon>
  <strong>${baja}</strong> alumnos de baja
</p>
        <hr style="margin: 0.75rem 0;">
        <p style="color:#DC2626; font-size:0.8rem;">Esta acción no se puede deshacer.</p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#E53E3E',
    cancelButtonColor: '#6B7280',
    confirmButtonText: 'Sí, procesar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      this.cargandoAvanzar = true;

      const payload = {
        id_periodo_origen: this.avanzarData.id_periodo_origen,
        id_periodo_destino: this.avanzarData.id_periodo_destino,
        alumnos: this.alumnosParaAvance.map(a => ({
          id_usuario: a.id_usuario,
          accion: a.accion
        }))
      };

      this.adminService.avanzarSemestre(payload).subscribe({
        next: (res) => {
          this.cargandoAvanzar = false;
          this.cerrarModalAvanzar();
          Swal.fire({
            title: '¡Proceso completado!',
            html: `<strong>${res.alumnosProcesados}</strong> alumno(s) procesado(s) correctamente.`,
            icon: 'success'
          });
          this.filtrosActivos ? this.aplicarFiltros() : this.cargarUsuarios();
        },
        error: (err) => {
          this.cargandoAvanzar = false;
          Swal.fire('Error', err?.error?.error || 'No se pudo procesar el avance.', 'error');
        }
      });
    }
  });
}


getNombrePeriodo(id: any): string {
  return this.periodos.find(p => p.id_periodo == id)?.nombre || `#${id}`;
}

  // ── Ver detalles ───────────────────────────────────────────

  verDetalles(usuario: any) {
    this.usuarioSeleccionado = { ...usuario };
    this.mostrarDetalles = true;
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.usuarioSeleccionado = null;
  }

  // ── Cambiar estado ─────────────────────────────────────────

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
            Swal.fire('Hecho', `Usuario ${nuevoEstado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`, 'success');
            this.filtrosActivos ? this.aplicarFiltros() : this.cargarUsuarios();
          },
          error: (err) =>
            Swal.fire('Error', err?.error?.error || 'No se pudo actualizar el estado.', 'error'),
        });
      }
    });
  }

  // ── Control dinámico de campos ─────────────────────────────

  campoActivo(campo: string): boolean {
    const rol = this.getRolNombre(this.nuevoUsuario.id_rol);
    if (!rol) return true;

    switch (rol) {
      case 'Administrador':
        return true;
      case 'Alumno':
        // ✅ CAMBIO: añadido 'id_periodo'
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','matricula','id_carrera','id_semestre','id_periodo','grupo','estado'].includes(campo);
      case 'Docente':
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','matricula','id_carrera','estado'].includes(campo);
      case 'Bibliotecario':
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','matricula','estado'].includes(campo);
      case 'Visitante':
        return ['nombre','a_paterno','a_materno','correo','telefono','contrasena','estado'].includes(campo);
      default:
        return true;
    }
  }

  getRolNombre(id_rol: number): string {
    const rol = this.roles.find((r) => r.id_rol === Number(id_rol));
    return rol ? rol.nombre_rol : '';
  }

  // ── Guardar usuario ────────────────────────────────────────

  guardarUsuario() {
    const user = this.nuevoUsuario;
    const isEdit = !!user.id_usuario;
    const rol = this.getRolNombre(user.id_rol);

    if (!user.nombre || !user.correo || !user.id_rol) {
      Swal.fire('Campos incompletos', 'Nombre, correo y rol son obligatorios.', 'info');
      return;
    }

    if (rol === 'Alumno') {
      if (!user.id_carrera || !user.id_semestre || !user.matricula || !user.telefono) {
        Swal.fire('Campos requeridos', 'Alumno debe tener carrera, semestre, matrícula y teléfono.', 'info');
        return;
      }
      if (!user.grupo || !['A', 'B'].includes(user.grupo)) {
        Swal.fire('Grupo requerido', 'Alumno debe tener un grupo válido (A o B).', 'info');
        return;
      }
      // ✅ CAMBIO: periodo obligatorio solo al crear
      if (!isEdit && !user.id_periodo) {
        Swal.fire('Periodo requerido', 'Alumno debe tener un periodo asignado.', 'info');
        return;
      }
    } else if (rol === 'Docente') {
      if (!user.id_carrera || !user.matricula || !user.telefono) {
        Swal.fire('Campos requeridos', 'Docente debe tener carrera, matrícula y teléfono.', 'info');
        return;
      }
      user.id_semestre = null;
      user.grupo = null;
      user.id_periodo = null; // ✅ CAMBIO: limpiar para no-alumnos
    } else if (rol === 'Bibliotecario') {
      if (!user.matricula || !user.telefono) {
        Swal.fire('Campos requeridos', 'Bibliotecario debe tener matrícula y teléfono.', 'info');
        return;
      }
      user.id_carrera = null;
      user.id_semestre = null;
      user.grupo = null;
      user.id_periodo = null; // ✅ CAMBIO: limpiar para no-alumnos
    } else if (rol === 'Visitante') {
      user.id_carrera = null;
      user.id_semestre = null;
      user.matricula = null;
      user.grupo = null;
      user.id_periodo = null; // ✅ CAMBIO: limpiar para no-alumnos
    }

    const payload = { ...user };

    if (isEdit) {
      if (this.nuevaContrasena && this.nuevaContrasena.trim() !== '') {
        payload.contrasena = this.nuevaContrasena;
      } else {
        delete payload.contrasena;
      }
      // ✅ CAMBIO: no enviar id_periodo si no se cambió al editar
      if (!payload.id_periodo) {
        delete payload.id_periodo;
      }
    } else {
      if (!user.contrasena || user.contrasena.trim() === '') {
        Swal.fire('Contraseña requerida', 'Debes ingresar una contraseña para el nuevo usuario.', 'info');
        return;
      }
    }

    const request = isEdit
      ? this.adminService.update(user.id_usuario, payload)
      : this.adminService.create(payload);

    request.subscribe({
      next: (res) => {
        Swal.fire('Éxito', res.message || 'Operación exitosa.', 'success');
        this.nuevoUsuario = this.resetForm();
        this.nuevaContrasena = '';
        this.editando = false;
        this.mostrarModal = false;
        this.filtrosActivos ? this.aplicarFiltros() : this.cargarUsuarios();
      },
      error: (err) =>
        Swal.fire('Error', err?.error?.error || 'No se pudo guardar.', 'error'),
    });
  }

  editarUsuario(u: any) {
    this.nuevoUsuario = { ...u, id_periodo: '' }; // ✅ CAMBIO: id_periodo vacío al editar (es opcional cambiarlo)
    this.nuevaContrasena = '';
    this.editando = true;
    this.mostrarModal = true;
  }

  volverAlPerfil() {
    this.router.navigate(['/perfil']);
  }

  // ── Importación ────────────────────────────────────────────

  abrirModalImportacion() {
    this.mostrarModalImportacion = true;
    this.resultadoImportacion = null;
    this.importData = { id_rol: '', id_carrera: '', id_semestre: '', grupo: '', id_periodo: '' }; // ✅ CAMBIO: añadido id_periodo
    this.archivoSeleccionado = null;
    this.esAlumnoImport = false;
  }

  cerrarImportacion() {
    this.mostrarModalImportacion = false;
  }

  onRolImportChange() {
    const rol = this.getRolNombre(this.importData.id_rol);
    this.esAlumnoImport = rol === 'Alumno';
    if (!this.esAlumnoImport) {
      this.importData.id_carrera = '';
      this.importData.id_semestre = '';
      this.importData.grupo = '';
      this.importData.id_periodo = ''; // ✅ CAMBIO: limpiar periodo
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.archivoSeleccionado = file;
  }

  descargarPlantilla() {
    this.adminService.downloadTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_importacion_usuarios.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => Swal.fire('Error', 'No se pudo descargar la plantilla.', 'error')
    });
  }

  importarUsuarios() {
    if (!this.importData.id_rol) {
      Swal.fire('Error', 'Debe seleccionar un rol.', 'warning');
      return;
    }
    if (this.esAlumnoImport && (!this.importData.id_carrera || !this.importData.id_semestre)) {
      Swal.fire('Error', 'Alumno requiere carrera y semestre.', 'warning');
      return;
    }
    if (this.esAlumnoImport && !this.importData.grupo) {
      Swal.fire('Error', 'Alumno requiere grupo (A o B).', 'warning');
      return;
    }
    // ✅ CAMBIO: validar periodo para alumnos
    if (this.esAlumnoImport && !this.importData.id_periodo) {
      Swal.fire('Error', 'Alumno requiere un periodo.', 'warning');
      return;
    }
    if (!this.archivoSeleccionado) {
      Swal.fire('Error', 'Debe seleccionar un archivo Excel.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', this.archivoSeleccionado);
    formData.append('id_rol', this.importData.id_rol);
    formData.append('id_carrera', this.importData.id_carrera || '');
    formData.append('id_semestre', this.importData.id_semestre || '');
    formData.append('grupo', this.importData.grupo || '');
    formData.append('id_periodo', this.importData.id_periodo || ''); // ✅ CAMBIO: añadido

    this.cargandoImport = true;

    this.adminService.importExcel(formData).subscribe({
      next: (res) => {
        console.log('📦 Respuesta importación:', JSON.stringify(res)); 
        this.resultadoImportacion = res;
        this.cargandoImport = false;
        this.cargarUsuarios();
        Swal.fire('Éxito', 'Importación completada.', 'success');
      },
      error: (err) => {
        this.cargandoImport = false;
        Swal.fire('Error', err?.error?.error || 'Error al importar.', 'error');
      }
    });
  }
}
