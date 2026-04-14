import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import Swal from 'sweetalert2';
import {
  PrestamoAdmin,
  PrestamoAdminPayload,
  PrestamoAdminService,
} from '../../../api/services/prestamo-admin.service';
import { AdminUserService } from '../../../api/services/admin-user.service';
import { CatalogAdminService } from '../../../api/services/admin.catalog.service';

interface EstudianteOption {
  id_usuario: number;
  nombre: string;
  a_paterno?: string | null;
  a_materno?: string | null;
  matricula?: string | null;
  carrera?: string | null;
  semestre?: string | null;
  grupo?: string | null;
  estado?: string | null;
}

interface LibroOption {
  id: number;
  titulo: string;
  autores?: string | null;
  editorial?: string | null;
  materias?: string | null;
  semestres?: string | null;
  semestres_ids?: string | null;
  disponibles?: number | null;
  total?: number | null;
  activo?: number | null;
}

type AccionPrestamo = 'devolver' | 'cancelar' | 'vencido' | 'activar';

@Component({
  selector: 'app-gestion-prestamos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './gestion-prestamos.html',
  styleUrls: ['./gestion-prestamos.css'],
  encapsulation: ViewEncapsulation.None,
})
export class GestionPrestamosComponent implements OnInit {
  readonly Math = Math;

  prestamos: PrestamoAdmin[] = [];
  prestamosFiltrados: PrestamoAdmin[] = [];

  cargando = false;
  guardandoPrestamo = false;
  cargandoEstudiantes = false;
  cargandoLibros = false;
  cargandoCatalogos = false;

  paginaActual = 1;
  itemsPorPagina = 10;

  filtros = {
    busqueda: '',
    estado: '',
    carrera: '',
    semestre: '',
    grupo: '',
    orden: 'DESC' as 'ASC' | 'DESC',
  };

  mostrarModalPrestamo = false;
  mostrarModalDetalles = false;
  mostrarModalEstudiantes = false;
  mostrarModalLibros = false;
  modoPrestamo: 'crear' | 'editar' = 'crear';
  prestamoEditando: PrestamoAdmin | null = null;
  prestamoSeleccionado: PrestamoAdmin | null = null;

  formPrestamo = {
    id_usuario: null as number | null,
    libro_id: null as number | null,
    observaciones: '',
  };

  estudianteSeleccionado: EstudianteOption | null = null;
  libroSeleccionado: LibroOption | null = null;

  estudiantes: EstudianteOption[] = [];
  estudiantesVisibles: EstudianteOption[] = [];
  libros: LibroOption[] = [];
  librosVisibles: LibroOption[] = [];

  carreras: any[] = [];
  semestres: any[] = [];
  materias: any[] = [];
  periodos: any[] = [];
  periodosActivos: any[] = [];
  semestresPeriodo: any[] = [];
  gruposPeriodo: string[] = ['A', 'B'];

  filtrosEstudiantes = {
    busqueda: '',
    id_periodo: '',
    id_carrera: '',
    id_semestre: '',
    grupo: '',
  };

  filtrosLibros = {
    busqueda: '',
    materia: '',
    semestre: '',
    disponibilidad: 'disponibles' as 'disponibles' | 'todos',
  };

  private pendientesPorUsuario = new Map<number, number>();
  private vencidosPorUsuario = new Map<number, number>();

  constructor(
    private prestamoService: PrestamoAdminService,
    private adminUserService: AdminUserService,
    private catalogAdminService: CatalogAdminService
  ) {}

  ngOnInit(): void {
    this.cargarPrestamos();
    this.cargarCatalogosBase();
  }

  cargarPrestamos(): void {
    this.cargando = true;

    this.prestamoService.listar().subscribe({
      next: (res) => {
        this.prestamos = Array.isArray(res?.data) ? res.data : [];
        this.actualizarResumenEstudiantes();
        this.aplicarFiltros();
      },
      error: (err) => {
        Swal.fire('Error', err?.error?.message || 'No se pudieron cargar los prestamos.', 'error');
      },
      complete: () => {
        this.cargando = false;
      },
    });
  }

  cargarCatalogosBase(): void {
    this.cargandoCatalogos = true;

    forkJoin({
      carreras: this.adminUserService.getCarreras(),
      semestres: this.adminUserService.getSemestres(),
      periodos: this.adminUserService.getPeriodosTodos(),
      periodosActivos: this.adminUserService.getPeriodosActivos().pipe(catchError(() => of([]))),
      materias: this.catalogAdminService.obtenerMaterias(),
    }).subscribe({
      next: ({ carreras, semestres, periodos, periodosActivos, materias }) => {
        this.carreras = Array.isArray(carreras) ? carreras : [];
        this.semestres = this.ordenarCatalogoSemestres(Array.isArray(semestres) ? semestres : []);
        this.semestresPeriodo = [...this.semestres];
        this.periodos = Array.isArray(periodos) ? periodos : [];
        this.periodosActivos = Array.isArray(periodosActivos)
          ? periodosActivos
          : periodosActivos
            ? [periodosActivos]
            : [];
        this.materias = Array.isArray(materias) ? materias : [];
        this.configurarPeriodoInicial();
      },
      error: (err) => {
        console.error('Error cargando catalogos base de prestamos:', err);
      },
      complete: () => {
        this.cargandoCatalogos = false;
      },
    });
  }

  aplicarFiltros(): void {
    let resultado = [...this.prestamos];

    if (this.filtros.estado) {
      resultado = resultado.filter((prestamo) => prestamo.estado === this.filtros.estado);
    }

    if (this.filtros.carrera) {
      resultado = resultado.filter(
        (prestamo) => (prestamo.carrera || '') === this.filtros.carrera
      );
    }

    if (this.filtros.semestre) {
      resultado = resultado.filter(
        (prestamo) => (prestamo.semestre || '') === this.filtros.semestre
      );
    }

    if (this.filtros.grupo) {
      resultado = resultado.filter((prestamo) => (prestamo.grupo || '') === this.filtros.grupo);
    }

    const busqueda = this.normalizeText(this.filtros.busqueda);
    if (busqueda) {
      resultado = resultado.filter((prestamo) => {
        const fullText = [
          prestamo.id_prestamo,
          prestamo.nombre_estudiante,
          prestamo.matricula,
          prestamo.titulo,
          prestamo.autores,
          prestamo.editorial,
          prestamo.carrera,
          prestamo.semestre,
        ]
          .map((value) => this.normalizeText(value))
          .join(' ');

        return fullText.includes(busqueda);
      });
    }

    resultado.sort((a, b) => {
      const first = new Date(a.fecha_prestamo).getTime();
      const second = new Date(b.fecha_prestamo).getTime();
      return this.filtros.orden === 'DESC' ? second - first : first - second;
    });

    this.prestamosFiltrados = resultado;
    this.paginaActual = 1;
  }

  limpiarFiltros(): void {
    this.filtros = {
      busqueda: '',
      estado: '',
      carrera: '',
      semestre: '',
      grupo: '',
      orden: 'DESC',
    };
    this.aplicarFiltros();
  }

  limpiarFiltrosEstudiantes(): void {
    this.filtrosEstudiantes = {
      busqueda: '',
      id_periodo: '',
      id_carrera: '',
      id_semestre: '',
      grupo: '',
    };
    this.semestresPeriodo = [...this.semestres];
    this.gruposPeriodo = ['A', 'B'];
    this.cargarEstudiantes();
  }

  limpiarFiltrosLibros(): void {
    this.filtrosLibros = {
      busqueda: '',
      materia: '',
      semestre: '',
      disponibilidad: 'disponibles',
    };
    this.cargarLibros();
  }

  abrirModalCrear(): void {
    this.modoPrestamo = 'crear';
    this.prestamoEditando = null;
    this.formPrestamo = {
      id_usuario: null,
      libro_id: null,
      observaciones: '',
    };
    this.estudianteSeleccionado = null;
    this.libroSeleccionado = null;
    this.mostrarModalPrestamo = true;
  }

  abrirModalEditar(prestamo: PrestamoAdmin): void {
    this.modoPrestamo = 'editar';
    this.prestamoEditando = prestamo;
    this.formPrestamo = {
      id_usuario: prestamo.id_usuario,
      libro_id: prestamo.libro_id,
      observaciones: prestamo.observaciones || '',
    };
    this.estudianteSeleccionado = {
      id_usuario: prestamo.id_usuario,
      nombre: prestamo.nombre,
      a_paterno: prestamo.a_paterno,
      a_materno: prestamo.a_materno,
      matricula: prestamo.matricula,
      carrera: prestamo.carrera,
      semestre: prestamo.semestre,
      grupo: prestamo.grupo,
      estado: prestamo.estado_usuario,
    };
    this.libroSeleccionado = {
      id: prestamo.libro_id,
      titulo: prestamo.titulo,
      autores: prestamo.autores,
      editorial: prestamo.editorial,
      disponibles: prestamo.stock_disponible,
      total: prestamo.stock_total,
      activo: 1,
    };
    this.mostrarModalPrestamo = true;
  }

  abrirModalDetalles(prestamo: PrestamoAdmin): void {
    this.prestamoSeleccionado = prestamo;
    this.mostrarModalDetalles = true;
  }

  cerrarModalDetalles(): void {
    this.mostrarModalDetalles = false;
    this.prestamoSeleccionado = null;
  }

  cerrarModalPrestamo(): void {
    if (this.guardandoPrestamo) return;

    this.mostrarModalPrestamo = false;
    this.prestamoEditando = null;
  }

  guardarPrestamo(): void {
    if (this.guardandoPrestamo || !this.formPrestamo.id_usuario || !this.formPrestamo.libro_id) {
      return;
    }

    const payload: PrestamoAdminPayload = {
      id_usuario: this.formPrestamo.id_usuario,
      libro_id: this.formPrestamo.libro_id,
      observaciones: this.normalizeNullable(this.formPrestamo.observaciones),
    };

    this.guardandoPrestamo = true;

    const request =
      this.modoPrestamo === 'crear'
        ? this.prestamoService.crear(payload)
        : this.prestamoService.actualizar(this.prestamoEditando!.id_prestamo, payload);

    request.subscribe({
      next: (res) => {
        Swal.fire(
          'Exito',
          res?.message ||
            (this.modoPrestamo === 'crear'
              ? 'Prestamo registrado correctamente.'
              : 'Prestamo actualizado correctamente.'),
          'success'
        );
        this.mostrarModalPrestamo = false;
        this.prestamoEditando = null;
        this.cargarPrestamos();
      },
      error: (err) => {
        Swal.fire('Error', err?.error?.message || 'No se pudo guardar el prestamo.', 'error');
      },
      complete: () => {
        this.guardandoPrestamo = false;
      },
    });
  }

  confirmarAccion(prestamo: PrestamoAdmin, accion: AccionPrestamo): void {
    const config = this.getAccionConfig(prestamo, accion);

    Swal.fire({
      title: config.title,
      html: config.html,
      icon: config.icon as any,
      input: 'textarea',
      inputLabel: 'Nota opcional',
      inputPlaceholder: 'Ejemplo: se corrigio el libro o el alumno devolvio en mostrador.',
      inputValue: prestamo.observaciones || '',
      showCancelButton: true,
      confirmButtonText: config.confirmButtonText,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: config.confirmButtonColor,
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const observaciones = this.normalizeNullable(result.value);
      const request = this.getAccionRequest(prestamo.id_prestamo, accion, observaciones);

      request.subscribe({
        next: (res) => {
          Swal.fire('Exito', res?.message || config.successMessage, 'success');
          this.cargarPrestamos();
        },
        error: (err) => {
          Swal.fire('Error', err?.error?.message || config.errorMessage, 'error');
        },
      });
    });
  }

  confirmarEliminacion(prestamo: PrestamoAdmin): void {
    Swal.fire({
      title: 'Eliminar prestamo',
      html: `
        <p>Se eliminara el registro del prestamo de <strong>${prestamo.titulo}</strong>.</p>
        <p>Esta accion no se puede deshacer.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.prestamoService.eliminar(prestamo.id_prestamo).subscribe({
        next: (res) => {
          if (this.prestamoSeleccionado?.id_prestamo === prestamo.id_prestamo) {
            this.cerrarModalDetalles();
          }

          Swal.fire('Exito', res?.message || 'Prestamo eliminado correctamente.', 'success');
          this.cargarPrestamos();
        },
        error: (err) => {
          Swal.fire('Error', err?.error?.message || 'No se pudo eliminar el prestamo.', 'error');
        },
      });
    });
  }

  abrirModalEstudiantes(): void {
    this.mostrarModalEstudiantes = true;
    this.cargarEstudiantes();
  }

  cerrarModalEstudiantes(): void {
    this.mostrarModalEstudiantes = false;
  }

  onPeriodoEstudiantesChange(recargar = true): void {
    this.filtrosEstudiantes.id_semestre = '';
    this.filtrosEstudiantes.grupo = '';
    this.semestresPeriodo = [...this.semestres];
    this.gruposPeriodo = ['A', 'B'];

    if (!this.filtrosEstudiantes.id_periodo) {
      if (recargar) {
        this.cargarEstudiantes();
      }
      return;
    }

    this.adminUserService.getOpcionesPorPeriodo(this.filtrosEstudiantes.id_periodo).subscribe({
      next: (res) => {
        this.semestresPeriodo = this.ordenarCatalogoSemestres(
          Array.isArray(res?.semestres) ? res.semestres : []
        );
        this.gruposPeriodo = Array.isArray(res?.grupos)
          ? [...res.grupos].sort((a, b) => a.localeCompare(b, 'es'))
          : [];

        if (recargar) {
          this.cargarEstudiantes();
        }
      },
      error: (err) => {
        console.error('Error al obtener opciones por periodo para prestamos:', err);
        if (recargar) {
          this.cargarEstudiantes();
        }
      },
    });
  }

  cargarEstudiantes(): void {
    this.cargandoEstudiantes = true;

    this.adminUserService
      .getFiltered({
        rol: 'Estudiante',
        id_periodo: this.filtrosEstudiantes.id_periodo,
        id_carrera: this.filtrosEstudiantes.id_carrera,
        id_semestre: this.filtrosEstudiantes.id_semestre,
        grupo: this.filtrosEstudiantes.grupo,
      })
      .subscribe({
        next: (res) => {
          this.estudiantes = this.ordenarEstudiantes(Array.isArray(res) ? res : []);
          this.aplicarFiltroEstudiantesLocal();
        },
        error: (err) => {
          this.estudiantes = [];
          this.estudiantesVisibles = [];
          Swal.fire(
            'Error',
            err?.error?.error || 'No se pudieron cargar los estudiantes disponibles.',
            'error'
          );
        },
        complete: () => {
          this.cargandoEstudiantes = false;
        },
      });
  }

  aplicarFiltroEstudiantesLocal(): void {
    const busqueda = this.normalizeText(this.filtrosEstudiantes.busqueda);

    if (!busqueda) {
      this.estudiantesVisibles = [...this.estudiantes];
      return;
    }

    this.estudiantesVisibles = this.estudiantes.filter((estudiante) => {
      const fullText = [
        estudiante.nombre,
        estudiante.a_paterno,
        estudiante.a_materno,
        estudiante.matricula,
        estudiante.carrera,
        estudiante.semestre,
        estudiante.grupo,
      ]
        .map((value) => this.normalizeText(value))
        .join(' ');

      return fullText.includes(busqueda);
    });
  }

  seleccionarEstudiante(estudiante: EstudianteOption): void {
    this.estudianteSeleccionado = estudiante;
    this.formPrestamo.id_usuario = estudiante.id_usuario;
    this.mostrarModalEstudiantes = false;
  }

  abrirModalLibros(): void {
    this.mostrarModalLibros = true;
    this.cargarLibros();
  }

  cerrarModalLibros(): void {
    this.mostrarModalLibros = false;
  }

  cargarLibros(): void {
    this.cargandoLibros = true;

    this.catalogAdminService
      .obtenerLibros({
        formato: 'FISICO',
        activo: 1,
        materia: this.filtrosLibros.materia,
        semestre: this.filtrosLibros.semestre,
      })
      .subscribe({
        next: (res) => {
          this.libros = (Array.isArray(res) ? res : []).map((libro: any) => ({
            id: libro.id,
            titulo: libro.titulo,
            autores: libro.autores,
            editorial: libro.editorial,
            materias: libro.materias,
            semestres: libro.semestres,
            semestres_ids: libro.semestres_ids,
            disponibles: this.toNumber(libro.disponibles),
            total: this.toNumber(libro.total),
            activo: this.toNumber(libro.activo),
          }));
          this.aplicarFiltroLibrosLocal();
        },
        error: (err) => {
          this.libros = [];
          this.librosVisibles = [];
          Swal.fire('Error', err?.error?.message || 'No se pudieron cargar los libros.', 'error');
        },
        complete: () => {
          this.cargandoLibros = false;
        },
      });
  }

  aplicarFiltroLibrosLocal(): void {
    const busqueda = this.normalizeText(this.filtrosLibros.busqueda);

    let resultado = [...this.libros];

    if (busqueda) {
      resultado = resultado.filter((libro) => {
        const fullText = [
          libro.titulo,
          libro.autores,
          libro.editorial,
          libro.materias,
          libro.semestres,
        ]
          .map((value) => this.normalizeText(value))
          .join(' ');

        return fullText.includes(busqueda);
      });
    }

    if (this.filtrosLibros.disponibilidad === 'disponibles') {
      resultado = resultado.filter(
        (libro) => this.puedeSeleccionarLibro(libro) || libro.id === this.formPrestamo.libro_id
      );
    }

    resultado.sort((a, b) => {
      const first = this.toNumber(b.disponibles) - this.toNumber(a.disponibles);
      if (first !== 0) return first;
      return (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' });
    });

    this.librosVisibles = resultado;
  }

  seleccionarLibro(libro: LibroOption): void {
    if (!this.puedeSeleccionarLibro(libro) && libro.id !== this.formPrestamo.libro_id) {
      return;
    }

    this.libroSeleccionado = libro;
    this.formPrestamo.libro_id = libro.id;
    this.mostrarModalLibros = false;
  }

  get prestamosPaginados(): PrestamoAdmin[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.prestamosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.prestamosFiltrados.length / this.itemsPorPagina));
  }

  get paginasVisibles(): Array<number | string> {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const delta = 2;
    const rango: number[] = [];
    const resultado: Array<number | string> = [];

    for (let index = 1; index <= total; index += 1) {
      if (index === 1 || index === total || (index >= actual - delta && index <= actual + delta)) {
        rango.push(index);
      }
    }

    let previo: number | null = null;

    rango.forEach((pagina) => {
      if (previo !== null && pagina - previo > 1) {
        resultado.push('...');
      }

      resultado.push(pagina);
      previo = pagina;
    });

    return resultado;
  }

  irAPagina(pagina: number | string): void {
    if (typeof pagina !== 'number') return;
    this.paginaActual = pagina;
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual -= 1;
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual += 1;
    }
  }

  cambiarItemsPorPagina(): void {
    this.paginaActual = 1;
  }

  get totalPrestamos(): number {
    return this.prestamos.length;
  }

  get totalActivos(): number {
    return this.prestamos.filter((prestamo) => prestamo.estado === 'Activo').length;
  }

  get totalVencidos(): number {
    return this.prestamos.filter((prestamo) => prestamo.estado === 'Vencido').length;
  }

  get totalDevueltos(): number {
    return this.prestamos.filter((prestamo) => prestamo.estado === 'Devuelto').length;
  }

  get totalCancelados(): number {
    return this.prestamos.filter((prestamo) => prestamo.estado === 'Cancelado').length;
  }

  get prestamosPendientes(): number {
    return this.prestamos.filter((prestamo) => ['Activo', 'Vencido'].includes(prestamo.estado))
      .length;
  }

  get prestamosHoy(): number {
    const hoy = this.getDateKey(new Date());
    return this.prestamos.filter((prestamo) => this.getDateKey(prestamo.fecha_prestamo) === hoy)
      .length;
  }

  get opcionesCarrera(): string[] {
    return this.getUniqueValues(this.prestamos.map((prestamo) => prestamo.carrera));
  }

  get opcionesSemestre(): string[] {
    return this.ordenarEtiquetasSemestre(
      this.getUniqueValues(this.prestamos.map((prestamo) => prestamo.semestre))
    );
  }

  get opcionesGrupo(): string[] {
    return this.getUniqueValues(this.prestamos.map((prestamo) => prestamo.grupo));
  }

  get estadosFiltro(): string[] {
    return ['Activo', 'Vencido', 'Devuelto', 'Cancelado'];
  }

  get descripcionVentanaPrestamo(): string {
    return this.modoPrestamo === 'crear'
      ? 'El sistema registra la fecha actual y fija el vencimiento el mismo dia a las 16:00.'
      : 'Aqui puedes corregir el estudiante, el libro y la nota del prestamo. Las fechas no se capturan manualmente.';
  }

  get hayFiltrosActivos(): boolean {
    return Boolean(
      this.filtros.busqueda ||
        this.filtros.estado ||
        this.filtros.carrera ||
        this.filtros.semestre ||
        this.filtros.grupo ||
        this.filtros.orden !== 'DESC'
    );
  }

  puedeEditar(prestamo: PrestamoAdmin): boolean {
    return prestamo.estado !== 'Devuelto';
  }

  puedeActivar(prestamo: PrestamoAdmin): boolean {
    return prestamo.estado === 'Cancelado' || prestamo.estado === 'Vencido';
  }

  esPendiente(prestamo: PrestamoAdmin): boolean {
    return prestamo.estado === 'Activo' || prestamo.estado === 'Vencido';
  }

  getBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      Activo: 'estado-activo',
      Vencido: 'estado-vencido',
      Devuelto: 'estado-devuelto',
      Cancelado: 'estado-cancelado',
    };

    return map[estado] || 'estado-neutro';
  }

  formatFecha(value: string | null): string {
    if (!value) return 'Sin registro';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  obtenerNombreCompleto(estudiante: EstudianteOption | null): string {
    if (!estudiante) return 'Aun no has seleccionado un estudiante';

    return [estudiante.nombre, estudiante.a_paterno, estudiante.a_materno]
      .filter(Boolean)
      .join(' ');
  }

  obtenerPendientesEstudiante(id_usuario: number): number {
    return this.pendientesPorUsuario.get(id_usuario) || 0;
  }

  obtenerVencidosEstudiante(id_usuario: number): number {
    return this.vencidosPorUsuario.get(id_usuario) || 0;
  }

  puedeSeleccionarEstudiante(estudiante: EstudianteOption): boolean {
    if (this.prestamoEditando?.id_usuario === estudiante.id_usuario) {
      return true;
    }

    return this.obtenerPendientesEstudiante(estudiante.id_usuario) < 3;
  }

  puedeSeleccionarLibro(libro: LibroOption): boolean {
    if (this.prestamoEditando?.libro_id === libro.id) {
      return true;
    }

    return this.toNumber(libro.disponibles) > 0;
  }

  private actualizarResumenEstudiantes(): void {
    this.pendientesPorUsuario.clear();
    this.vencidosPorUsuario.clear();

    this.prestamos.forEach((prestamo) => {
      if (!this.esPendiente(prestamo)) return;

      this.pendientesPorUsuario.set(
        prestamo.id_usuario,
        (this.pendientesPorUsuario.get(prestamo.id_usuario) || 0) + 1
      );

      if (prestamo.estado === 'Vencido') {
        this.vencidosPorUsuario.set(
          prestamo.id_usuario,
          (this.vencidosPorUsuario.get(prestamo.id_usuario) || 0) + 1
        );
      }
    });
  }

  private configurarPeriodoInicial(): void {
    if (this.filtrosEstudiantes.id_periodo) return;

    const periodo = this.obtenerPeriodoInicial();
    if (!periodo?.id_periodo) return;

    this.filtrosEstudiantes.id_periodo = String(periodo.id_periodo);
    this.onPeriodoEstudiantesChange(false);
  }

  private obtenerPeriodoInicial(): any {
    const activos = [...this.periodosActivos].sort((a, b) => {
      return this.getTimestamp(b?.fecha_inicio) - this.getTimestamp(a?.fecha_inicio);
    });

    if (activos.length > 0) {
      return activos[0];
    }

    const todos = [...this.periodos].sort((a, b) => {
      return this.getTimestamp(b?.fecha_inicio) - this.getTimestamp(a?.fecha_inicio);
    });

    return todos[0] || null;
  }

  private ordenarEstudiantes(lista: any[]): EstudianteOption[] {
    return [...lista].sort((a, b) => {
      return (
        this.normalizeText(a?.a_paterno).localeCompare(this.normalizeText(b?.a_paterno), 'es') ||
        this.normalizeText(a?.a_materno).localeCompare(this.normalizeText(b?.a_materno), 'es') ||
        this.normalizeText(a?.nombre).localeCompare(this.normalizeText(b?.nombre), 'es') ||
        this.normalizeText(a?.matricula).localeCompare(this.normalizeText(b?.matricula), 'es')
      );
    });
  }

  private getAccionConfig(prestamo: PrestamoAdmin, accion: AccionPrestamo) {
    const nombre = prestamo.nombre_estudiante;
    const libro = prestamo.titulo;

    const configs: Record<AccionPrestamo, any> = {
      devolver: {
        title: 'Confirmar devolucion',
        html: `<p><strong>${nombre}</strong> devolvera <strong>${libro}</strong>.</p>`,
        icon: 'question',
        confirmButtonText: 'Si, devolver',
        confirmButtonColor: '#0f766e',
        successMessage: 'Prestamo devuelto correctamente.',
        errorMessage: 'No se pudo marcar la devolucion.',
      },
      cancelar: {
        title: 'Cancelar prestamo',
        html: `<p>Se cancelara el prestamo de <strong>${libro}</strong> para <strong>${nombre}</strong>.</p>`,
        icon: 'warning',
        confirmButtonText: 'Si, cancelar',
        confirmButtonColor: '#dc2626',
        successMessage: 'Prestamo cancelado correctamente.',
        errorMessage: 'No se pudo cancelar el prestamo.',
      },
      vencido: {
        title: 'Marcar como vencido',
        html: `<p>El prestamo de <strong>${libro}</strong> quedara marcado como vencido.</p>`,
        icon: 'warning',
        confirmButtonText: 'Si, marcar',
        confirmButtonColor: '#d97706',
        successMessage: 'Prestamo marcado como vencido.',
        errorMessage: 'No se pudo actualizar el estado del prestamo.',
      },
      activar: {
        title: 'Reactivar prestamo',
        html: `<p>El prestamo de <strong>${libro}</strong> volvera a estar activo con fecha actual y vencimiento hoy a las 16:00.</p>`,
        icon: 'question',
        confirmButtonText: 'Si, activar',
        confirmButtonColor: '#2563eb',
        successMessage: 'Prestamo activado correctamente.',
        errorMessage: 'No se pudo activar el prestamo.',
      },
    };

    return configs[accion];
  }

  private getAccionRequest(id: number, accion: AccionPrestamo, observaciones?: string | null) {
    switch (accion) {
      case 'devolver':
        return this.prestamoService.devolver(id, observaciones);
      case 'cancelar':
        return this.prestamoService.cancelar(id, observaciones);
      case 'vencido':
        return this.prestamoService.marcarVencido(id, observaciones);
      case 'activar':
        return this.prestamoService.activar(id, observaciones);
      default:
        return this.prestamoService.cancelar(id, observaciones);
    }
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized === '' ? null : normalized;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getUniqueValues(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => !!value && value.trim() !== ''))]
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  private ordenarCatalogoSemestres<T extends { nombre_semestre?: string | null }>(
    lista: T[]
  ): T[] {
    return [...lista].sort((a, b) =>
      this.compararSemestres(a?.nombre_semestre, b?.nombre_semestre)
    );
  }

  private ordenarEtiquetasSemestre(lista: string[]): string[] {
    return [...lista].sort((a, b) => this.compararSemestres(a, b));
  }

  private compararSemestres(a: unknown, b: unknown): number {
    const semestreA = this.obtenerOrdenSemestre(a);
    const semestreB = this.obtenerOrdenSemestre(b);

    if (semestreA.numero !== null && semestreB.numero !== null && semestreA.numero !== semestreB.numero) {
      return semestreA.numero - semestreB.numero;
    }

    if (semestreA.numero !== null && semestreB.numero === null) {
      return -1;
    }

    if (semestreA.numero === null && semestreB.numero !== null) {
      return 1;
    }

    return semestreA.texto.localeCompare(semestreB.texto, 'es', { sensitivity: 'base' });
  }

  private obtenerOrdenSemestre(value: unknown): { numero: number | null; texto: string } {
    const textoOriginal = String(value ?? '').trim();
    const texto = this.normalizeText(value);
    const matchNumero = texto.match(/\d+/);

    if (matchNumero) {
      return {
        numero: Number(matchNumero[0]),
        texto: textoOriginal,
      };
    }

    const equivalencias: Array<[string, number]> = [
      ['primer', 1],
      ['segundo', 2],
      ['tercer', 3],
      ['tercero', 3],
      ['cuarto', 4],
      ['quinto', 5],
      ['sexto', 6],
      ['septimo', 7],
      ['octavo', 8],
      ['noveno', 9],
      ['decimo', 10],
    ];

    const encontrado = equivalencias.find(([palabra]) => texto.includes(palabra));

    return {
      numero: encontrado ? encontrado[1] : null,
      texto: textoOriginal,
    };
  }

  private getTimestamp(value: unknown): number {
    const date = new Date(String(value ?? ''));
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private getDateKey(value: unknown): string {
    const date = new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
