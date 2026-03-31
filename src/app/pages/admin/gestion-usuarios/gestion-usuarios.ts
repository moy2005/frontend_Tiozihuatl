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
  usuarios: any[] = [];
  roles: any[] = [];
  carreras: any[] = [];
  semestres: any[] = [];
  periodos: any[] = [];
  periodosActivos: any[] = [];

  cargando = false;
  editando = false;
  nuevoUsuario: any = this.resetForm();
  nuevaContrasena = '';
  mostrarModal = false;
  mostrarDetalles = false;
  usuarioSeleccionado: any = null;

  mostrarModalImportacion = false;
  cargandoImport = false;
  archivoSeleccionado: File | null = null;
  resultadoImportacion: any = null;
  importData: any = { id_rol: '', id_carrera: '', id_semestre: '', grupo: '', id_periodo: '' };
  esEstudianteImport = false;

  previewImport: any[] = [];
  mostrarPreview = false;

  mostrarFiltros = false;
  filtros: any = {
    rol: '',
    id_carrera: '',
    id_semestre: '',
    grupo: '',
    id_periodo: ''
  };
  filtrosActivos = false;
  semestresFiltro: any[] = [];
  gruposFiltro: string[] = [];
  filtrosInicializados = false;

  mostrarModalAvanzar = false;
  pasoAvanzar = 1;
  cargandoAvanzar = false;
  cargandoPreview = false;
  estudiantesParaAvance: any[] = [];
  filtrosAvance = {
    semestre: '',
    grupo: ''
  };
  semestresAvanceDisponibles: Array<{ id: string; nombre: string }> = [];
  gruposAvanceDisponibles: string[] = [];
  estudiantesParaAvanceFiltrados: any[] = [];
  avanzarData: any = {
    id_periodo_origen: '',
    id_periodo_destino: ''
  };

  paginaActual = 1;
  itemsPorPagina = 15;
  totalPaginas = 0;
  filtrosExpandidos = false;
  Math = Math;

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
      id_rol: '',
      id_carrera: '',
      id_semestre: '',
      id_periodo: '',
      nombre: '',
      a_paterno: '',
      a_materno: '',
      correo: '',
      telefono: '',
      contrasena: '',
      matricula: '',
      grupo: '',
      estado: 'Activo',
    };
  }

  get rolFormularioActual(): string {
    return this.getRolNombre(this.nuevoUsuario.id_rol);
  }

  get importIdentifierKey(): string {
    return this.esEstudianteImport ? 'matricula' : 'correo';
  }

  get importIdentifierLabel(): string {
    return this.esEstudianteImport ? 'Matrícula' : 'Correo';
  }

  get importTemplateFileName(): string {
    if (this.esEstudianteImport) {
      return 'plantilla_importacion_estudiantes.xlsx';
    }

    const rol = this.getRolNombre(this.importData.id_rol) || 'usuarios';
    return `plantilla_importacion_${rol.toLowerCase()}.xlsx`;
  }

  get filasValidas(): number {
    return this.previewImport.filter((r) => this.esFilaImportValida(r)).length;
  }

  get filasInvalidas(): number {
    return this.previewImport.filter((r) => !this.esFilaImportValida(r)).length;
  }

  private tieneValor(value: any): boolean {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  esFilaImportValida(row: any): boolean {
    return (
      this.tieneValor(row?.[this.importIdentifierKey]) &&
      this.tieneValor(row?.a_paterno) &&
      this.tieneValor(row?.a_materno) &&
      this.tieneValor(row?.nombre)
    );
  }

  onPeriodoFiltroChange() {
    this.filtros.id_semestre = '';
    this.filtros.grupo = '';
    this.semestresFiltro = [];
    this.gruposFiltro = [];

    if (!this.filtros.id_periodo) {
      this.semestresFiltro = this.semestres;
      this.gruposFiltro = ['A', 'B'];
      this.aplicarFiltros();
      return;
    }

    this.adminService.getOpcionesPorPeriodo(this.filtros.id_periodo).subscribe({
      next: (res) => {
        this.semestresFiltro = Array.isArray(res?.semestres) ? res.semestres : [];
        this.gruposFiltro = this.ordenarGrupos(res?.grupos);
        this.filtros.id_semestre = this.semestresFiltro[0]?.id_semestre
          ? String(this.semestresFiltro[0].id_semestre)
          : '';
        this.filtros.grupo = this.gruposFiltro[0] || '';
        this.aplicarFiltros();
      },
      error: (err) => console.error('Error al cargar opciones del periodo:', err)
    });
  }

  get usuariosPaginados() {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.usuarios.slice(inicio, inicio + this.itemsPorPagina);
  }

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
    const delta = 2;
    const rango: number[] = [];
    const rangoConPuntos: (number | string)[] = [];

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= actual - delta && i <= actual + delta)) {
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
    if (this.paginaActual > 1) this.paginaActual--;
  }

  paginaSiguiente() {
    if (this.paginaActual < this.totalPaginas) this.paginaActual++;
  }

  cambiarItemsPorPagina() {
    this.paginaActual = 1;
    this.calcularTotalPaginas();
  }

  toggleFiltros() {
    this.filtrosExpandidos = !this.filtrosExpandidos;
  }

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
      next: (res) => {
        this.roles = res;
        this.intentarAplicarFiltrosPorDefecto();
      },
      error: (err) => console.error('Error al obtener roles', err),
    });
  }

  cargarCatalogos() {
    this.adminService.getCarreras().subscribe({
      next: (res) => {
        this.carreras = res;
        this.intentarAplicarFiltrosPorDefecto();
      },
      error: (err) => console.error('Error al obtener carreras:', err),
    });

    this.adminService.getSemestres().subscribe({
      next: (res) => {
        this.semestres = res;
        this.semestresFiltro = res;
      },
      error: (err) => console.error('Error al obtener semestres:', err),
    });

    this.gruposFiltro = ['A', 'B'];
  }

  cargarPeriodosActivos() {
    this.adminService.getPeriodosTodos().subscribe({
      next: (res) => {
        this.periodos = Array.isArray(res) ? res : res ? [res] : [];
        this.intentarAplicarFiltrosPorDefecto();
      },
      error: (err) => console.error('Error al obtener periodos:', err),
    });

    this.adminService.getPeriodosActivos().subscribe({
      next: (res) => {
        this.periodosActivos = Array.isArray(res) ? res : res ? [res] : [];
        this.intentarAplicarFiltrosPorDefecto();
      },
      error: (err) => console.error('Error al obtener periodos activos:', err),
    });
  }

  abrirFiltros() {
    this.mostrarFiltros = true;
  }

  cerrarFiltros() {
    this.mostrarFiltros = false;
  }

  aplicarFiltros() {
    const hayFiltro = Object.values(this.filtros).some((v) => v !== '');
    if (!hayFiltro) {
      this.limpiarFiltros();
      return;
    }

    this.cargando = true;
    this.filtrosActivos = true;
    this.paginaActual = 1;

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
    this.semestresFiltro = this.semestres;
    this.gruposFiltro = ['A', 'B'];
    this.paginaActual = 1;
    this.cargarUsuarios();
  }

  get rolFiltroNombre(): string {
    return this.filtros.rol || '';
  }

  get filtroPorPeriodo(): boolean {
    return !!this.filtros.id_periodo;
  }

  abrirModalAvanzar() {
    this.avanzarData = { id_periodo_origen: '', id_periodo_destino: '' };
    this.estudiantesParaAvance = [];
    this.resetFiltrosAvance();
    this.pasoAvanzar = 1;
    this.mostrarModalAvanzar = true;
  }

  cerrarModalAvanzar() {
    this.mostrarModalAvanzar = false;
    this.pasoAvanzar = 1;
    this.estudiantesParaAvance = [];
    this.resetFiltrosAvance();
  }

  cargarPreviewAvance() {
    if (!this.avanzarData.id_periodo_origen) return;
    this.cargandoPreview = true;

    this.adminService.getPreviewAvance(this.avanzarData.id_periodo_origen).subscribe({
      next: (res) => {
        this.estudiantesParaAvance = this.ordenarEstudiantesAvance(
          res.map((a) => ({ ...a, accion: 'AVANZAR' }))
        );
        this.limpiarFiltrosAvance();
        this.cargandoPreview = false;
        this.pasoAvanzar = 2;
      },
      error: () => {
        this.cargandoPreview = false;
        Swal.fire('Error', 'No se pudieron cargar los estudiantes del periodo.', 'error');
      }
    });
  }

  get totalEstudiantesVisiblesAvance(): number {
    return this.estudiantesParaAvanceFiltrados.length;
  }

  limpiarFiltrosAvance() {
    this.filtrosAvance = { semestre: '', grupo: '' };
    this.actualizarOpcionesAvance();
    this.actualizarVistaAvance();
  }

  onSemestreAvanceChange() {
    this.actualizarOpcionesAvance();

    if (
      this.filtrosAvance.grupo &&
      !this.gruposAvanceDisponibles.includes(this.filtrosAvance.grupo)
    ) {
      this.filtrosAvance = { ...this.filtrosAvance, grupo: '' };
    }

    this.actualizarVistaAvance();
  }

  onGrupoAvanceChange() {
    this.actualizarVistaAvance();
  }

  countAccion(accion: string): number {
    return this.estudiantesParaAvance.filter((a) => a.accion === accion).length;
  }

  toggleTodosAvanzar(accion: string) {
    this.estudiantesParaAvance.forEach((a) => (a.accion = accion));
  }

  ejecutarAvanzarSemestre() {
    const avanzar = this.countAccion('AVANZAR');
    const repetir = this.countAccion('REPETIR');
    const baja = this.countAccion('BAJA');

    const periodoOrigenNombre =
      this.periodos.find((p) => p.id_periodo == this.avanzarData.id_periodo_origen)?.nombre ||
      `#${this.avanzarData.id_periodo_origen}`;
    const periodoDestinoNombre =
      this.periodos.find((p) => p.id_periodo == this.avanzarData.id_periodo_destino)?.nombre ||
      `#${this.avanzarData.id_periodo_destino}`;

    Swal.fire({
      title: '¿Confirmar proceso?',
      html: `
        <div style="text-align:left; font-size:0.875rem;">
          <p><strong>Origen:</strong> ${periodoOrigenNombre}</p>
          <p><strong>Destino:</strong> ${periodoDestinoNombre}</p>
          <hr style="margin: 0.75rem 0;">
          <p style="display:flex; align-items:center; gap:0.5rem; margin:0.35rem 0;">
            <ion-icon name="arrow-up-circle-outline" style="font-size:1.1rem; color:#16A34A;"></ion-icon>
            <strong>${avanzar}</strong> estudiantes avanzan de semestre
          </p>
          <p style="display:flex; align-items:center; gap:0.5rem; margin:0.35rem 0;">
            <ion-icon name="refresh-circle-outline" style="font-size:1.1rem; color:#D97706;"></ion-icon>
            <strong>${repetir}</strong> estudiantes repiten
          </p>
          <p style="display:flex; align-items:center; gap:0.5rem; margin:0.35rem 0;">
            <ion-icon name="remove-circle-outline" style="font-size:1.1rem; color:#DC2626;"></ion-icon>
            <strong>${baja}</strong> estudiantes de baja
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
          estudiantes: this.estudiantesParaAvance.map((a) => ({
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
              html: `<strong>${res.estudiantesProcesados}</strong> estudiante(s) procesado(s) correctamente.`,
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
    return this.periodos.find((p) => p.id_periodo == id)?.nombre || `#${id}`;
  }

  private resetFiltrosAvance() {
    this.filtrosAvance = { semestre: '', grupo: '' };
    this.semestresAvanceDisponibles = [];
    this.gruposAvanceDisponibles = [];
    this.estudiantesParaAvanceFiltrados = [];
  }

  private actualizarOpcionesAvance() {
    const semestresMap = new Map<string, { id: string; nombre: string; orden: number }>();

    this.estudiantesParaAvance.forEach((estudiante) => {
      if (!this.tieneValor(estudiante.id_semestre)) return;

      const id = String(estudiante.id_semestre);

      if (!semestresMap.has(id)) {
        semestresMap.set(id, {
          id,
          nombre: estudiante.nombre_semestre || `Semestre ${id}`,
          orden: Number(estudiante.id_semestre) || Number.MAX_SAFE_INTEGER
        });
      }
    });

    this.semestresAvanceDisponibles = Array.from(semestresMap.values())
      .sort((a, b) => a.orden - b.orden || this.compararTextoAvance(a.nombre, b.nombre))
      .map(({ id, nombre }) => ({ id, nombre }));

    const baseGrupos = this.filtrosAvance.semestre
      ? this.estudiantesParaAvance.filter(
          (estudiante) => String(estudiante.id_semestre) === this.filtrosAvance.semestre
        )
      : this.estudiantesParaAvance;

    this.gruposAvanceDisponibles = Array.from(
      new Set(
        baseGrupos
          .map((estudiante) => String(estudiante.grupo || '').trim())
          .filter((grupo) => grupo !== '')
      )
    ).sort((a, b) => this.compararTextoAvance(a, b));
  }

  private actualizarVistaAvance() {
    let lista = [...this.estudiantesParaAvance];

    if (this.filtrosAvance.semestre) {
      lista = lista.filter(
        (estudiante) => String(estudiante.id_semestre) === this.filtrosAvance.semestre
      );
    }

    if (this.filtrosAvance.grupo) {
      lista = lista.filter(
        (estudiante) => String(estudiante.grupo || '').trim() === this.filtrosAvance.grupo
      );
    }

    this.estudiantesParaAvanceFiltrados = this.ordenarEstudiantesAvance(lista);
  }

  private ordenarEstudiantesAvance(lista: any[]): any[] {
    return [...lista].sort((a, b) => {
      return (
        this.compararTextoAvance(a?.a_paterno, b?.a_paterno) ||
        this.compararTextoAvance(a?.a_materno, b?.a_materno) ||
        this.compararTextoAvance(a?.nombre, b?.nombre) ||
        this.compararTextoAvance(a?.matricula, b?.matricula)
      );
    });
  }

  private compararTextoAvance(a: any, b: any): number {
    return String(a ?? '')
      .trim()
      .localeCompare(String(b ?? '').trim(), 'es-MX', { sensitivity: 'base' });
  }

  verDetalles(usuario: any) {
    this.usuarioSeleccionado = { ...usuario };
    this.mostrarDetalles = true;
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.usuarioSeleccionado = null;
  }

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
        this.adminService.update(usuario.id_usuario, { estado: nuevoEstado }).subscribe({
          next: () => {
            Swal.fire(
              'Hecho',
              `Usuario ${nuevoEstado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`,
              'success'
            );
            this.filtrosActivos ? this.aplicarFiltros() : this.cargarUsuarios();
          },
          error: (err) =>
            Swal.fire('Error', err?.error?.error || 'No se pudo actualizar el estado.', 'error'),
        });
      }
    });
  }

  campoActivo(campo: string): boolean {
    const rol = this.getRolNombre(this.nuevoUsuario.id_rol);
    if (!rol) return true;

    if (rol === 'Estudiante') {
      return [
        'nombre',
        'a_paterno',
        'a_materno',
        'correo',
        'telefono',
        'matricula',
        'id_carrera',
        'id_semestre',
        'id_periodo',
        'grupo',
        'estado',
      ].includes(campo);
    }

    return ['nombre', 'a_paterno', 'a_materno', 'correo', 'telefono', 'contrasena', 'estado'].includes(campo);
  }

  mostrarCampoFormulario(campo: string): boolean {
    const rol = this.getRolNombre(this.nuevoUsuario.id_rol);

    if ((campo === 'correo' || campo === 'telefono') && !this.editando && rol === 'Estudiante') {
      return false;
    }

    return true;
  }

  getRolNombre(id_rol: number): string {
    const rol = this.roles.find((r) => r.id_rol === Number(id_rol));
    return rol ? rol.nombre_rol : '';
  }

  guardarUsuario() {
    const user = this.nuevoUsuario;
    const isEdit = !!user.id_usuario;
    const rol = this.getRolNombre(user.id_rol);

    if (!user.nombre || !user.a_paterno || !user.id_rol) {
      Swal.fire('Campos incompletos', 'Nombre, apellido paterno y rol son obligatorios.', 'info');
      return;
    }

    if (rol === 'Estudiante') {
      if (!user.id_carrera || !user.id_semestre || !user.matricula) {
        Swal.fire('Campos requeridos', 'Estudiante debe tener carrera, semestre y matrícula.', 'info');
        return;
      }
      if (!user.grupo || !['A', 'B'].includes(user.grupo)) {
        Swal.fire('Grupo requerido', 'Estudiante debe tener un grupo válido (A o B).', 'info');
        return;
      }
      if (!user.id_periodo) {
        Swal.fire('Periodo requerido', 'Estudiante debe tener un periodo asignado.', 'info');
        return;
      }
      if (!isEdit) {
        user.correo = '';
        user.telefono = '';
      }
    } else {
      if (!user.correo || String(user.correo).trim() === '') {
        Swal.fire('Campos requeridos', `${rol || 'El usuario'} debe tener correo electrónico.`, 'info');
        return;
      }
      user.id_carrera = null;
      user.id_semestre = null;
      user.matricula = null;
      user.grupo = null;
      user.id_periodo = null;
    }

    const payload = { ...user };

    if (isEdit) {
      if (this.nuevaContrasena && this.nuevaContrasena.trim() !== '') {
        payload.contrasena = this.nuevaContrasena;
      } else {
        delete payload.contrasena;
      }

      if (!payload.id_periodo) {
        delete payload.id_periodo;
      }
    } else {
      delete payload.contrasena;
    }

    const request = isEdit
      ? this.adminService.update(user.id_usuario, payload)
      : this.adminService.create(payload);

    request.subscribe({
      next: (res) => {
        if (res.tokens_excel_b64) {
          const identificadorArchivo =
            payload.matricula || payload.correo || payload.nombre || 'usuario';
          this.descargarExcelTokens(
            res.tokens_excel_b64,
            `token_activacion_${String(identificadorArchivo).replace(/\s+/g, '_')}.xlsx`
          );
        }

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
    this.nuevoUsuario = {
      ...this.resetForm(),
      ...u,
      correo: u.correo || '',
      telefono: u.telefono || '',
      matricula: u.matricula || '',
      grupo: u.grupo || '',
      id_carrera: u.id_carrera || '',
      id_semestre: u.id_semestre || '',
      id_periodo: u.id_periodo || '',
    };
    this.nuevaContrasena = '';
    this.editando = true;
    this.mostrarModal = true;
  }

  volverAlPerfil() {
    this.router.navigate(['/perfil']);
  }

  abrirModalImportacion() {
    this.mostrarModalImportacion = true;
    this.resultadoImportacion = null;
    this.importData = { id_rol: '', id_carrera: '', id_semestre: '', grupo: '', id_periodo: '' };
    this.archivoSeleccionado = null;
    this.previewImport = [];
    this.mostrarPreview = false;
    this.esEstudianteImport = false;
  }

  cerrarImportacion() {
    this.mostrarModalImportacion = false;
  }

  onRolImportChange() {
    const rol = this.getRolNombre(this.importData.id_rol);
    this.esEstudianteImport = rol === 'Estudiante';

    if (!this.esEstudianteImport) {
      this.importData.id_carrera = '';
      this.importData.id_semestre = '';
      this.importData.grupo = '';
      this.importData.id_periodo = '';
    }
  }

  onRolFormularioChange() {
    const rol = this.getRolNombre(this.nuevoUsuario.id_rol);

    this.nuevoUsuario.id_carrera = '';
    this.nuevoUsuario.id_semestre = '';
    this.nuevoUsuario.matricula = '';
    this.nuevoUsuario.grupo = '';
    this.nuevoUsuario.id_periodo = '';

    if (!this.editando && rol === 'Estudiante') {
      this.nuevoUsuario.correo = '';
      this.nuevoUsuario.telefono = '';
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.archivoSeleccionado = file;
    this.previewImport = [];
    this.mostrarPreview = false;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        import('xlsx').then((XLSX) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);

          this.previewImport = rows.slice(0, 50);
          this.mostrarPreview = rows.length > 0;

          if (!rows.length) {
            Swal.fire('Archivo vacío', 'El archivo Excel no contiene datos.', 'warning');
          }
        });
      } catch {
        Swal.fire('Error', 'No se pudo leer el archivo Excel.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  descargarPlantilla() {
    if (!this.importData.id_rol) {
      Swal.fire('Rol requerido', 'Selecciona primero el rol para descargar la plantilla correcta.', 'info');
      return;
    }

    this.adminService.downloadTemplate(this.importData.id_rol).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.importTemplateFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => Swal.fire('Error', 'No se pudo descargar la plantilla.', 'error')
    });
  }

  regenerarToken(usuario: any) {
    Swal.fire({
      title: '¿Regenerar token de activación?',
      html: `
        <p>Se generará un nuevo enlace para <strong>${usuario.a_paterno} ${usuario.nombre}</strong>.</p>
        <p class="text-sm text-gray-500 mt-1">El token anterior quedará inválido.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2196F3',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, regenerar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.regenerarToken(usuario.id_usuario).subscribe({
          next: (res) => {
            if (res.tokens_excel_b64) {
              this.descargarExcelTokens(
                res.tokens_excel_b64,
                `token_${usuario.matricula || usuario.correo || usuario.id_usuario}.xlsx`
              );
            }
            Swal.fire({
              icon: 'success',
              title: 'Token regenerado',
              text: 'Se descargó el nuevo token de activación.',
            });
          },
          error: (err) =>
            Swal.fire('Error', err?.error?.error || 'No se pudo regenerar el token.', 'error'),
        });
      }
    });
  }

  importarUsuarios() {
    if (!this.importData.id_rol) {
      Swal.fire('Error', 'Debe seleccionar un rol.', 'warning');
      return;
    }
    if (this.esEstudianteImport && (!this.importData.id_carrera || !this.importData.id_semestre)) {
      Swal.fire('Error', 'Estudiante requiere carrera y semestre.', 'warning');
      return;
    }
    if (this.esEstudianteImport && !this.importData.grupo) {
      Swal.fire('Error', 'Estudiante requiere grupo (A o B).', 'warning');
      return;
    }
    if (this.esEstudianteImport && !this.importData.id_periodo) {
      Swal.fire('Error', 'Estudiante requiere un periodo.', 'warning');
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
    formData.append('id_periodo', this.importData.id_periodo || '');

    this.cargandoImport = true;

    this.adminService.importExcel(formData).subscribe({
      next: (res) => {
        this.resultadoImportacion = res;
        this.cargandoImport = false;
        this.cargarUsuarios();

        if (res.tokens_excel_b64 && res.insertados > 0) {
          this.descargarExcelTokens(res.tokens_excel_b64, 'tokens_activacion.xlsx');
        }

        Swal.fire({
          icon: 'success',
          title: 'Importación completada',
          html: `
            <p><strong>${res.insertados}</strong> usuario(s) creados correctamente.</p>
            ${res.omitidos > 0 ? `<p class="text-sm text-gray-500 mt-1">${res.omitidos} fila(s) omitidas.</p>` : ''}
            ${res.insertados > 0 ? '<p class="text-sm text-blue-600 mt-2">Se descargó el archivo con los tokens de activación.</p>' : ''}
          `,
        });
      },
      error: (err) => {
        this.cargandoImport = false;
        Swal.fire('Error', err?.error?.error || 'Error al importar.', 'error');
      },
    });
  }

  private descargarExcelTokens(base64: string, nombreArchivo: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = Array.from(byteCharacters, (c) => c.charCodeAt(0));
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private intentarAplicarFiltrosPorDefecto() {
    if (
      this.filtrosInicializados ||
      !this.roles.length ||
      !this.carreras.length ||
      !this.periodos.length
    ) {
      return;
    }

    const periodoInicial = this.obtenerPeriodoInicial();
    if (!periodoInicial) {
      return;
    }

    this.filtrosInicializados = true;
    this.filtros = {
      rol: 'Estudiante',
      id_carrera: this.carreras[0]?.id_carrera ? String(this.carreras[0].id_carrera) : '',
      id_semestre: '',
      grupo: '',
      id_periodo: String(periodoInicial.id_periodo),
    };

    this.onPeriodoFiltroChange();
  }

  private obtenerPeriodoInicial() {
    const periodosActivosOrdenados = [...this.periodosActivos].sort((a, b) => {
      const fechaA = a?.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
      const fechaB = b?.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
      return fechaB - fechaA;
    });

    if (periodosActivosOrdenados.length > 0) {
      return periodosActivosOrdenados[0];
    }

    const periodosOrdenados = [...this.periodos].sort((a, b) => {
      const fechaA = a?.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
      const fechaB = b?.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
      return fechaB - fechaA;
    });

    return periodosOrdenados[0] || null;
  }

  private ordenarGrupos(grupos: string[] = []): string[] {
    return [...new Set(grupos)]
      .filter((grupo) => !!grupo)
      .sort((a, b) => a.localeCompare(b, 'es'));
  }
}
