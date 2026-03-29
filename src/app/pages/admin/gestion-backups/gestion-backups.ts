import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { BackupService } from '../../../api/services/backup.service';
import { AutomationService } from '../../../api/services/automation.service';

type CalendarView = 'day' | 'week' | 'month' | 'agenda';
type BackupFrequency = 'daily' | 'interval' | 'days';
type HistoryFilter = 'todos' | 'automatico' | 'manual';
type PageToken = number | '...';

interface FrequencyOption {
  value: BackupFrequency;
  label: string;
  icon: string;
  hint: string;
}

interface DayOption {
  label: string;
  longLabel: string;
  value: number;
}

interface AutomationTaskApi {
  id_tarea: number;
  nombre_tarea: string;
  tipo_tarea: string;
  cron_expression: string;
  activo: boolean | number;
  ultima_ejecucion: string | null;
}

interface BackupHistoryItem {
  id_backup: number;
  tipo: 'manual' | 'automatico';
  alcance: 'database' | 'table';
  tabla_afectada: string | null;
  nombre_archivo: string;
  fecha: string | null;
  url_backup: string | null;
}

interface CronDescriptor {
  kind: 'daily' | 'interval' | 'days' | 'custom';
  summary: string;
  shortSummary: string;
  icon: string;
  utcHour?: number;
  utcMinute?: number;
  intervalHours?: number;
  daysOfWeek?: number[];
}

interface ScheduledBackupTask extends AutomationTaskApi {
  activo: boolean;
  descriptor: CronDescriptor;
}

interface CalendarOccurrence {
  id: string;
  taskId: number;
  task: ScheduledBackupTask;
  start: Date;
  end: Date;
  displayTime: string;
  summary: string;
}

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

interface AgendaGroup {
  key: string;
  label: string;
  date: Date;
  items: CalendarOccurrence[];
}

interface CalendarViewOption {
  value: CalendarView;
  label: string;
}

@Component({
  selector: 'app-gestion-backups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-backups.html',
  styleUrls: ['./gestion-backups.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class GestionBackupsComponent implements OnInit {
  cargandoCompleto = false;
  cargandoTabla = false;
  cargandoProgramar = false;
  cargandoTareas = false;
  cargandoHistorial = false;

  tablaSeleccionada = '';
  tablas: string[] = [];

  tipoFrecuencia: BackupFrequency = 'daily';
  horaInicio = '02:00';
  intervaloHoras = 6;
  diasSeleccionados: number[] = [];

  filtroTipo: HistoryFilter = 'todos';
  filtroHistorial = '';
  historialPaginaActual = 1;
  historialItemsPorPagina = 6;
  historialTotalPaginas = 0;

  tareas: ScheduledBackupTask[] = [];
  historialCompleto: BackupHistoryItem[] = [];
  historialFiltrado: BackupHistoryItem[] = [];

  vistaActual: CalendarView = 'week';
  fechaEnfoque = this.startOfDay(new Date());
  diasVisibles: Date[] = [];
  celdasMes: CalendarDay[] = [];
  miniCalendario: CalendarDay[] = [];
  agendaGrupos: AgendaGroup[] = [];
  ocurrenciasVisibles: CalendarOccurrence[] = [];
  siguienteRespaldo: CalendarOccurrence | null = null;

  tareaSeleccionada: ScheduledBackupTask | null = null;
  ocurrenciaSeleccionada: CalendarOccurrence | null = null;
  siguientesDetalle: CalendarOccurrence[] = [];

  readonly vistas: CalendarViewOption[] = [
    { value: 'day', label: 'Dia' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'agenda', label: 'Agenda' },
  ];

  readonly opcionesFrecuencia: FrequencyOption[] = [
    {
      value: 'daily',
      label: 'Diario',
      icon: 'sunny-outline',
      hint: 'Un respaldo al dia a una hora fija.',
    },
    {
      value: 'interval',
      label: 'Intervalo',
      icon: 'repeat-outline',
      hint: 'Varias ejecuciones a lo largo del dia.',
    },
    {
      value: 'days',
      label: 'Dias fijos',
      icon: 'calendar-outline',
      hint: 'Solo en dias especificos de la semana.',
    },
  ];

  readonly dias: DayOption[] = [
    { label: 'Lun', longLabel: 'Lunes', value: 1 },
    { label: 'Mar', longLabel: 'Martes', value: 2 },
    { label: 'Mie', longLabel: 'Miercoles', value: 3 },
    { label: 'Jue', longLabel: 'Jueves', value: 4 },
    { label: 'Vie', longLabel: 'Viernes', value: 5 },
    { label: 'Sab', longLabel: 'Sabado', value: 6 },
    { label: 'Dom', longLabel: 'Domingo', value: 0 },
  ];

  readonly opcionesFiltroTipo = [
    { value: 'todos' as const, label: 'Todos', icon: 'list-outline' },
    { value: 'automatico' as const, label: 'Automaticos', icon: 'sync-outline' },
    { value: 'manual' as const, label: 'Manuales', icon: 'hand-left-outline' },
  ];

  readonly cabeceraSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  readonly horasVista = Array.from({ length: 24 }, (_, hour) => hour);

  private readonly alturaHora = 70;
  private readonly duracionEventoMinutos = 42;
  private readonly fallbackTables = [
    'usuarios',
    'libros',
    'prestamos',
    'revistas',
    'compras',
    'detalle_compra',
    'pagos',
    'noticias',
    'materias',
  ];

  private readonly etiquetasTablas: Record<string, string> = {
    usuarios: 'Usuarios',
    libros: 'Libros',
    prestamos: 'Prestamos',
    revistas: 'Revistas',
    compras: 'Compras',
    detalle_compra: 'Detalle de compras',
    pagos: 'Pagos',
    noticias: 'Noticias',
    materias: 'Materias',
  };

  private ocurrenciasPorDia = new Map<string, CalendarOccurrence[]>();

  constructor(
    private readonly backupService: BackupService,
    private readonly automationService: AutomationService,
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.cargarTablas(),
      this.cargarTareas(),
      this.cargarHistorial(),
    ]);
    this.actualizarCalendario();
  }

  get tituloRango(): string {
    if (this.vistaActual === 'day') {
      return this.formatearFecha(this.fechaEnfoque, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    if (this.vistaActual === 'week') {
      const inicio = this.startOfWeek(this.fechaEnfoque);
      const fin = this.addDays(inicio, 6);
      return `${this.formatearFecha(inicio, {
        day: 'numeric',
        month: 'short',
      })} - ${this.formatearFecha(fin, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    }

    if (this.vistaActual === 'month') {
      return this.formatearFecha(this.fechaEnfoque, {
        month: 'long',
        year: 'numeric',
      });
    }

    const finAgenda = this.addDays(this.fechaEnfoque, 13);
    return `${this.formatearFecha(this.fechaEnfoque, {
      day: 'numeric',
      month: 'short',
    })} - ${this.formatearFecha(finAgenda, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  get tituloMiniCalendario(): string {
    return this.formatearFecha(this.fechaEnfoque, {
      month: 'long',
      year: 'numeric',
    });
  }

  get totalActivas(): number {
    return this.tareas.filter((tarea) => tarea.activo).length;
  }

  get totalPausadas(): number {
    return this.tareas.filter((tarea) => !tarea.activo).length;
  }

  get resumenProgramacionActual(): string {
    try {
      return this.parseCronExpression(this.generarCron()).summary;
    } catch {
      return 'Completa la configuracion para ver la recurrencia.';
    }
  }

  get detalleActual(): ScheduledBackupTask | null {
    return this.ocurrenciaSeleccionada?.task ?? this.tareaSeleccionada;
  }

  get cargandoRespaldoManual(): boolean {
    return this.cargandoCompleto || this.cargandoTabla;
  }

  get mensajeCargaManual(): string {
    if (this.cargandoCompleto) {
      return 'Generando respaldo completo y subiendo a la nube...';
    }

    if (this.cargandoTabla) {
      return 'Generando respaldo de la seccion seleccionada...';
    }

    return '';
  }

  get historialPaginado(): BackupHistoryItem[] {
    const inicio = (this.historialPaginaActual - 1) * this.historialItemsPorPagina;
    return this.historialFiltrado.slice(inicio, inicio + this.historialItemsPorPagina);
  }

  get historialInicioActual(): number {
    if (this.historialFiltrado.length === 0) {
      return 0;
    }
    return (this.historialPaginaActual - 1) * this.historialItemsPorPagina + 1;
  }

  get historialFinActual(): number {
    return Math.min(
      this.historialPaginaActual * this.historialItemsPorPagina,
      this.historialFiltrado.length,
    );
  }

  get historialPaginas(): PageToken[] {
    this.calcularTotalPaginasHistorial();

    const total = this.historialTotalPaginas;
    const actual = this.historialPaginaActual;
    const delta = 1;
    const paginasVisibles: number[] = [];
    const resultado: PageToken[] = [];

    for (let pagina = 1; pagina <= total; pagina++) {
      if (
        pagina === 1
        || pagina === total
        || (pagina >= actual - delta && pagina <= actual + delta)
      ) {
        paginasVisibles.push(pagina);
      }
    }

    let previo: number | null = null;
    paginasVisibles.forEach((pagina) => {
      if (previo && pagina - previo !== 1) {
        resultado.push('...');
      }
      resultado.push(pagina);
      previo = pagina;
    });

    return resultado;
  }

  etiquetaTabla(tabla: string | null): string {
    if (!tabla) {
      return 'Sin seccion';
    }
    return this.etiquetasTablas[tabla] ?? tabla;
  }

  setVista(vista: CalendarView): void {
    this.vistaActual = vista;
    this.actualizarCalendario();
  }

  irHoy(): void {
    this.fechaEnfoque = this.startOfDay(new Date());
    this.actualizarCalendario();
  }

  moverCalendario(delta: number): void {
    if (this.vistaActual === 'day') {
      this.fechaEnfoque = this.addDays(this.fechaEnfoque, delta);
    } else if (this.vistaActual === 'week') {
      this.fechaEnfoque = this.addDays(this.fechaEnfoque, delta * 7);
    } else if (this.vistaActual === 'month') {
      this.fechaEnfoque = this.addMonths(this.fechaEnfoque, delta);
    } else {
      this.fechaEnfoque = this.addDays(this.fechaEnfoque, delta * 14);
    }
    this.actualizarCalendario();
  }

  moverMiniCalendario(delta: number): void {
    this.fechaEnfoque = this.addMonths(this.fechaEnfoque, delta);
    this.actualizarCalendario();
  }

  seleccionarDia(date: Date): void {
    this.fechaEnfoque = this.startOfDay(date);
    this.actualizarCalendario();
  }

  abrirDia(date: Date): void {
    this.fechaEnfoque = this.startOfDay(date);
    this.vistaActual = 'day';
    this.actualizarCalendario();
  }

  seleccionarTarea(tarea: ScheduledBackupTask): void {
    this.tareaSeleccionada = tarea;
    this.ocurrenciaSeleccionada = this.obtenerSiguientesEjecuciones(tarea, 1)[0] ?? null;
    this.actualizarDetalleSeleccionado();
  }

  seleccionarOcurrencia(occurrence: CalendarOccurrence): void {
    this.ocurrenciaSeleccionada = occurrence;
    this.tareaSeleccionada = occurrence.task;
    this.actualizarDetalleSeleccionado();
  }

  isSelectedTask(tarea: ScheduledBackupTask): boolean {
    return this.detalleActual?.id_tarea === tarea.id_tarea;
  }

  toggleDia(value: number): void {
    if (this.diasSeleccionados.includes(value)) {
      this.diasSeleccionados = this.diasSeleccionados.filter((dia) => dia !== value);
      return;
    }

    this.diasSeleccionados = [...this.diasSeleccionados, value].sort((a, b) => {
      if (a === 0) {
        return 1;
      }
      if (b === 0) {
        return -1;
      }
      return a - b;
    });
  }

  ajustarIntervalo(delta: number): void {
    const siguienteValor = this.intervaloHoras + delta;
    this.intervaloHoras = Math.min(24, Math.max(2, siguienteValor));
  }

  describirCron(expr: string): string {
    return this.parseCronExpression(expr).summary;
  }

  formatearFechaHora(fecha: string | Date | null): string {
    if (!fecha) {
      return 'Sin registro';
    }

    if (fecha instanceof Date) {
      return this.formatearFechaHoraDesdeDate(fecha);
    }

    const dateLocal = this.parseFechaSinConvertirZona(fecha);
    if (dateLocal) {
      return this.formatearFechaHoraDesdeDate(dateLocal);
    }

    const fallback = new Date(fecha);
    if (Number.isNaN(fallback.getTime())) {
      return fecha;
    }

    return this.formatearFechaHoraDesdeDate(fallback);
  }

  formatearSoloHora(date: Date): string {
    return new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  formatearHoraEje(hour: number): string {
    return new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric',
    }).format(new Date(2024, 0, 1, hour, 0, 0, 0));
  }

  formatearFechaAgenda(date: Date): string {
    return this.formatearFecha(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  formatearDiaCabecera(date: Date): string {
    return this.formatearFecha(date, {
      weekday: 'short',
    });
  }

  formatearDiaNumero(date: Date): string {
    return this.formatearFecha(date, {
      day: 'numeric',
    });
  }

  esHoy(date: Date): boolean {
    return this.dateKey(date) === this.dateKey(new Date());
  }

  getMonthCellEvents(date: Date): CalendarOccurrence[] {
    return (this.ocurrenciasPorDia.get(this.dateKey(date)) ?? []).slice(0, 3);
  }

  getMonthOverflowCount(date: Date): number {
    const total = (this.ocurrenciasPorDia.get(this.dateKey(date)) ?? []).length;
    return Math.max(0, total - 3);
  }

  getOcurrenciasDia(date: Date): CalendarOccurrence[] {
    return this.ocurrenciasPorDia.get(this.dateKey(date)) ?? [];
  }

  getEventStyle(occurrence: CalendarOccurrence): Record<string, string> {
    const startMinutes = occurrence.start.getHours() * 60 + occurrence.start.getMinutes();
    const top = (startMinutes / 60) * this.alturaHora;
    const height = Math.max(40, (this.duracionEventoMinutos / 60) * this.alturaHora);

    return {
      top: `${top}px`,
      height: `${height}px`,
    };
  }

  async recargarModulo(): Promise<void> {
    await Promise.all([
      this.cargarTablas(),
      this.cargarTareas(),
      this.cargarHistorial(),
    ]);
  }

  async backupCompleto(): Promise<void> {
    this.cargandoCompleto = true;
    try {
      const response = await firstValueFrom(this.backupService.backupDatabase());
      await Swal.fire({
        title: 'Respaldo generado',
        html: `El respaldo <b>${response.fileName}</b> se guardo correctamente en Cloudinary.`,
        icon: 'success',
      });
      await this.cargarHistorial();
    } catch {
      await Swal.fire('Error', 'No se pudo generar el respaldo completo.', 'error');
    } finally {
      this.cargandoCompleto = false;
    }
  }

  async backupTabla(): Promise<void> {
    if (!this.tablaSeleccionada) {
      await Swal.fire(
        'Selecciona una seccion',
        'Debes elegir una seccion del sistema antes de continuar.',
        'warning',
      );
      return;
    }

    this.cargandoTabla = true;
    try {
      const response = await firstValueFrom(
        this.backupService.backupTable(this.tablaSeleccionada),
      );
      await Swal.fire({
        title: 'Respaldo generado',
        html: `La seccion <b>${this.etiquetaTabla(this.tablaSeleccionada)}</b> se respaldo y se guardo en Cloudinary.`,
        icon: 'success',
      });
      if (response.fileName) {
        await this.cargarHistorial();
      }
    } catch {
      await Swal.fire('Error', 'No se pudo generar el respaldo de la seccion.', 'error');
    } finally {
      this.cargandoTabla = false;
    }
  }

  async programarBackup(): Promise<void> {
    if (this.tipoFrecuencia === 'interval' && this.intervaloHoras < 2) {
      await Swal.fire('Intervalo invalido', 'El minimo permitido es de 2 horas.', 'warning');
      return;
    }

    if (this.tipoFrecuencia === 'days' && this.diasSeleccionados.length === 0) {
      await Swal.fire(
        'Selecciona los dias',
        'Debes elegir al menos un dia de la semana.',
        'warning',
      );
      return;
    }

    this.cargandoProgramar = true;
    try {
      const cronExpression = this.generarCron();
      await firstValueFrom(
        this.automationService.createBackupTask({
          nombre_tarea: 'Respaldo automatico',
          tipo_tarea: 'backup_database',
          cron_expression: cronExpression,
        }),
      );

      await Swal.fire(
        'Programacion guardada',
        'La automatizacion se creo correctamente.',
        'success',
      );

      await this.cargarTareas();
      if (this.tareas.length > 0) {
        this.seleccionarTarea(this.tareas[0]);
      }
    } catch (error: unknown) {
      let mensaje = 'No se pudo guardar la programacion.';
      if (error instanceof HttpErrorResponse) {
        mensaje = error.error?.message || error.message || mensaje;
      }
      await Swal.fire('Error', mensaje, 'error');
    } finally {
      this.cargandoProgramar = false;
    }
  }

  async cargarTablas(): Promise<void> {
    try {
      const response = await firstValueFrom(this.backupService.getTables());
      this.tablas = response.tables.length > 0
        ? response.tables
        : [...this.fallbackTables];
    } catch (error) {
      console.error(error);
      this.tablas = [...this.fallbackTables];
    }
  }

  async cargarTareas(): Promise<void> {
    this.cargandoTareas = true;
    try {
      const response = await firstValueFrom(this.automationService.getTasks());
      const tasks = (Array.isArray(response) ? response : []) as AutomationTaskApi[];

      this.tareas = tasks
        .filter((task) => task.tipo_tarea === 'backup_database')
        .map((task) => ({
          ...task,
          activo: Boolean(task.activo),
          descriptor: this.parseCronExpression(task.cron_expression),
        }))
        .sort((first, second) => {
          const firstNext = this.obtenerSiguientesEjecuciones(first, 1)[0]?.start.getTime()
            ?? Number.MAX_SAFE_INTEGER;
          const secondNext = this.obtenerSiguientesEjecuciones(second, 1)[0]?.start.getTime()
            ?? Number.MAX_SAFE_INTEGER;
          return firstNext - secondNext;
        });

      this.sincronizarSeleccion();
      this.actualizarCalendario();
    } catch (error) {
      console.error(error);
    } finally {
      this.cargandoTareas = false;
    }
  }

  async toggleTask(id: number): Promise<void> {
    try {
      await firstValueFrom(this.automationService.toggleTask(id));
      await this.cargarTareas();
    } catch {
      await Swal.fire('Error', 'No se pudo actualizar el estado de la programacion.', 'error');
    }
  }

  async eliminarTarea(id: number): Promise<void> {
    const result = await Swal.fire({
      title: 'Eliminar programacion',
      text: 'Esta accion eliminara la automatizacion seleccionada.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d93025',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await firstValueFrom(this.automationService.deleteTask(id));
      if (this.detalleActual?.id_tarea === id) {
        this.tareaSeleccionada = null;
        this.ocurrenciaSeleccionada = null;
      }
      await this.cargarTareas();
    } catch {
      await Swal.fire('Error', 'No se pudo eliminar la programacion.', 'error');
    }
  }

  async cargarHistorial(): Promise<void> {
    this.cargandoHistorial = true;
    try {
      const response = await firstValueFrom(this.backupService.getBackupHistory());
      this.historialCompleto = (Array.isArray(response) ? response : []) as BackupHistoryItem[];
      this.aplicarFiltroHistorial(false);
    } catch (error) {
      console.error(error);
      this.historialCompleto = [];
      this.historialFiltrado = [];
      this.calcularTotalPaginasHistorial();
    } finally {
      this.cargandoHistorial = false;
    }
  }

  aplicarFiltroHistorial(resetPage = true): void {
    const busqueda = this.filtroHistorial.trim().toLowerCase();

    this.historialFiltrado = this.historialCompleto.filter((item) => {
      const coincideTipo = this.filtroTipo === 'todos' || item.tipo === this.filtroTipo;
      const coincideTexto = !busqueda || item.nombre_archivo.toLowerCase().includes(busqueda);
      return coincideTipo && coincideTexto;
    });

    if (resetPage) {
      this.historialPaginaActual = 1;
    }

    this.calcularTotalPaginasHistorial();
  }

  irAHistorialPagina(page: PageToken): void {
    if (typeof page === 'number') {
      this.historialPaginaActual = page;
    }
  }

  historialPaginaAnterior(): void {
    if (this.historialPaginaActual > 1) {
      this.historialPaginaActual--;
    }
  }

  historialPaginaSiguiente(): void {
    if (this.historialPaginaActual < this.historialTotalPaginas) {
      this.historialPaginaActual++;
    }
  }

  cambiarItemsPorPaginaHistorial(): void {
    this.historialPaginaActual = 1;
    this.calcularTotalPaginasHistorial();
  }

  obtenerSiguientesEjecuciones(
    tarea: ScheduledBackupTask,
    limite: number,
  ): CalendarOccurrence[] {
    const inicio = new Date();
    const fin = this.addDays(inicio, 30);
    return this.expandOccurrences(tarea, inicio, fin).slice(0, limite);
  }

  private sincronizarSeleccion(): void {
    if (this.tareaSeleccionada) {
      this.tareaSeleccionada = this.tareas.find(
        (task) => task.id_tarea === this.tareaSeleccionada?.id_tarea,
      ) ?? null;
    }

    if (this.ocurrenciaSeleccionada) {
      const task = this.tareas.find(
        (item) => item.id_tarea === this.ocurrenciaSeleccionada?.taskId,
      );
      if (!task) {
        this.ocurrenciaSeleccionada = null;
      } else {
        this.ocurrenciaSeleccionada = this.obtenerSiguientesEjecuciones(task, 1)[0] ?? null;
      }
    }

    this.actualizarDetalleSeleccionado();
  }

  private actualizarDetalleSeleccionado(): void {
    const detalle = this.detalleActual;
    this.siguientesDetalle = detalle
      ? this.obtenerSiguientesEjecuciones(detalle, 5)
      : [];
  }

  private actualizarCalendario(): void {
    this.miniCalendario = this.buildMonthGrid(this.fechaEnfoque);

    const range = this.getVisibleRange();
    this.ocurrenciasVisibles = this.buildOccurrencesForRange(range.start, range.end);
    this.ocurrenciasPorDia = this.groupOccurrencesByDay(this.ocurrenciasVisibles);
    this.agendaGrupos = this.buildAgendaGroups(this.ocurrenciasVisibles);

    const proximas = this.buildOccurrencesForRange(new Date(), this.addDays(new Date(), 21));
    this.siguienteRespaldo = proximas.find((occurrence) => occurrence.task.activo) ?? null;

    this.actualizarDetalleSeleccionado();
  }

  private getVisibleRange(): { start: Date; end: Date } {
    if (this.vistaActual === 'day') {
      const day = this.startOfDay(this.fechaEnfoque);
      this.diasVisibles = [day];
      this.celdasMes = [];
      return { start: day, end: this.endOfDay(day) };
    }

    if (this.vistaActual === 'week') {
      const start = this.startOfWeek(this.fechaEnfoque);
      this.diasVisibles = Array.from({ length: 7 }, (_, index) => this.addDays(start, index));
      this.celdasMes = [];
      return { start, end: this.endOfDay(this.addDays(start, 6)) };
    }

    if (this.vistaActual === 'month') {
      this.celdasMes = this.buildMonthGrid(this.fechaEnfoque);
      this.diasVisibles = [];
      return {
        start: this.startOfDay(this.celdasMes[0].date),
        end: this.endOfDay(this.celdasMes[this.celdasMes.length - 1].date),
      };
    }

    const start = this.startOfDay(this.fechaEnfoque);
    const end = this.endOfDay(this.addDays(start, 13));
    this.diasVisibles = [];
    this.celdasMes = [];
    return { start, end };
  }

  private buildMonthGrid(reference: Date): CalendarDay[] {
    const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const gridStart = this.startOfWeek(monthStart);
    const todayKey = this.dateKey(new Date());
    const selectedKey = this.dateKey(this.fechaEnfoque);

    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(gridStart, index);
      return {
        date,
        inCurrentMonth: date.getMonth() === reference.getMonth(),
        isToday: this.dateKey(date) === todayKey,
        isSelected: this.dateKey(date) === selectedKey,
      };
    });
  }

  private buildOccurrencesForRange(start: Date, end: Date): CalendarOccurrence[] {
    return this.tareas
      .flatMap((task) => this.expandOccurrences(task, start, end))
      .sort((first, second) => first.start.getTime() - second.start.getTime());
  }

  private expandOccurrences(
    task: ScheduledBackupTask,
    visibleStart: Date,
    visibleEnd: Date,
  ): CalendarOccurrence[] {
    const descriptor = task.descriptor;
    const occurrences: CalendarOccurrence[] = [];
    const scanStart = this.addDays(this.startOfDay(visibleStart), -1);
    const scanEnd = this.addDays(this.startOfDay(visibleEnd), 1);

    for (
      let cursor = new Date(scanStart);
      cursor.getTime() <= scanEnd.getTime();
      cursor = this.addDays(cursor, 1)
    ) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const day = cursor.getDate();

      if (descriptor.kind === 'interval') {
        const step = descriptor.intervalHours ?? 1;
        for (let hour = 0; hour < 24; hour += step) {
          const candidate = new Date(Date.UTC(year, month, day, hour, 0, 0, 0));
          if (candidate >= visibleStart && candidate <= visibleEnd) {
            occurrences.push(this.createOccurrence(task, candidate));
          }
        }
        continue;
      }

      if (descriptor.kind === 'daily' || descriptor.kind === 'days') {
        if (descriptor.kind === 'days' && descriptor.daysOfWeek) {
          const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
          if (!descriptor.daysOfWeek.includes(weekday)) {
            continue;
          }
        }

        const candidate = new Date(
          Date.UTC(
            year,
            month,
            day,
            descriptor.utcHour ?? 0,
            descriptor.utcMinute ?? 0,
            0,
            0,
          ),
        );

        if (candidate >= visibleStart && candidate <= visibleEnd) {
          occurrences.push(this.createOccurrence(task, candidate));
        }
      }
    }

    return occurrences;
  }

  private createOccurrence(
    task: ScheduledBackupTask,
    start: Date,
  ): CalendarOccurrence {
    const end = new Date(start.getTime() + this.duracionEventoMinutos * 60_000);
    return {
      id: `${task.id_tarea}-${start.toISOString()}`,
      taskId: task.id_tarea,
      task,
      start,
      end,
      displayTime: this.formatearSoloHora(start),
      summary: task.descriptor.shortSummary,
    };
  }

  private groupOccurrencesByDay(
    occurrences: CalendarOccurrence[],
  ): Map<string, CalendarOccurrence[]> {
    const map = new Map<string, CalendarOccurrence[]>();

    occurrences.forEach((occurrence) => {
      const key = this.dateKey(occurrence.start);
      const list = map.get(key) ?? [];
      list.push(occurrence);
      map.set(key, list);
    });

    return map;
  }

  private buildAgendaGroups(occurrences: CalendarOccurrence[]): AgendaGroup[] {
    const grouped = new Map<string, AgendaGroup>();

    occurrences.forEach((occurrence) => {
      const key = this.dateKey(occurrence.start);
      const current = grouped.get(key);
      if (current) {
        current.items.push(occurrence);
        return;
      }

      grouped.set(key, {
        key,
        date: this.startOfDay(occurrence.start),
        label: this.formatearFechaAgenda(occurrence.start),
        items: [occurrence],
      });
    });

    return Array.from(grouped.values()).sort(
      (first, second) => first.date.getTime() - second.date.getTime(),
    );
  }

  private parseCronExpression(expr: string): CronDescriptor {
    if (!expr) {
      return {
        kind: 'custom',
        summary: 'Cron no disponible',
        shortSummary: 'Sin cron',
        icon: 'help-circle-outline',
      };
    }

    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) {
      return {
        kind: 'custom',
        summary: expr,
        shortSummary: 'Personalizado',
        icon: 'help-circle-outline',
      };
    }

    const minute = Number(parts[0]);
    const hour = parts[1];
    const daysExpression = parts[4];

    if (hour.startsWith('*/')) {
      const intervalHours = Number(hour.slice(2));
      if (!Number.isFinite(intervalHours) || intervalHours < 1) {
        return {
          kind: 'custom',
          summary: expr,
          shortSummary: 'Personalizado',
          icon: 'help-circle-outline',
        };
      }

      return {
        kind: 'interval',
        intervalHours,
        summary: `Cada ${intervalHours} horas`,
        shortSummary: `Cada ${intervalHours} h`,
        icon: 'repeat-outline',
      };
    }

    const utcHour = Number(hour);
    if (!Number.isFinite(minute) || !Number.isFinite(utcHour)) {
      return {
        kind: 'custom',
        summary: expr,
        shortSummary: 'Personalizado',
        icon: 'help-circle-outline',
      };
    }

    const localTime = this.formatTimeFromUtc(utcHour, minute);

    if (daysExpression !== '*') {
      const daysOfWeek = daysExpression
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

      const labels = daysOfWeek.map((day) => this.shortDayLabel(day)).join(', ');

      return {
        kind: 'days',
        daysOfWeek,
        utcHour,
        utcMinute: minute,
        summary: `${labels} a las ${localTime}`,
        shortSummary: labels,
        icon: 'calendar-outline',
      };
    }

    return {
      kind: 'daily',
      utcHour,
      utcMinute: minute,
      summary: `Todos los dias a las ${localTime}`,
      shortSummary: `Todos los dias, ${localTime}`,
      icon: 'sunny-outline',
    };
  }

  private generarCron(): string {
    const [hourString, minuteString] = this.horaInicio.split(':');
    const localHour = Number(hourString);
    const localMinute = Number(minuteString);

    const localDate = new Date();
    localDate.setHours(localHour, localMinute, 0, 0);

    const hourUtc = localDate.getUTCHours();
    const minuteUtc = localDate.getUTCMinutes();

    if (this.tipoFrecuencia === 'daily') {
      return `${minuteUtc} ${hourUtc} * * *`;
    }

    if (this.tipoFrecuencia === 'interval') {
      if (this.intervaloHoras < 2) {
        throw new Error('Intervalo invalido');
      }
      return `0 */${this.intervaloHoras} * * *`;
    }

    if (this.diasSeleccionados.length === 0) {
      throw new Error('Selecciona al menos un dia');
    }

    return `${minuteUtc} ${hourUtc} * * ${this.diasSeleccionados.join(',')}`;
  }

  private formatTimeFromUtc(hourUtc: number, minuteUtc: number): string {
    const date = new Date(Date.UTC(2024, 0, 1, hourUtc, minuteUtc, 0, 0));
    return new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  private shortDayLabel(day: number): string {
    const map: Record<number, string> = {
      0: 'Dom',
      1: 'Lun',
      2: 'Mar',
      3: 'Mie',
      4: 'Jue',
      5: 'Vie',
      6: 'Sab',
    };
    return map[day] ?? String(day);
  }

  private formatearFecha(
    date: Date,
    options: Intl.DateTimeFormatOptions,
  ): string {
    return new Intl.DateTimeFormat('es-MX', options).format(date);
  }

  private formatearFechaHoraDesdeDate(date: Date): string {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private parseFechaSinConvertirZona(fecha: string): Date | null {
    const match = fecha.trim().match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
    );

    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute, second = '0'] = match;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      0,
    );
  }

  private calcularTotalPaginasHistorial(): void {
    this.historialTotalPaginas = Math.ceil(
      this.historialFiltrado.length / this.historialItemsPorPagina,
    );

    if (this.historialTotalPaginas === 0) {
      this.historialPaginaActual = 1;
      return;
    }

    if (this.historialPaginaActual > this.historialTotalPaginas) {
      this.historialPaginaActual = this.historialTotalPaginas;
    }
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  private startOfWeek(date: Date): Date {
    const current = this.startOfDay(date);
    const day = current.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return this.addDays(current, diff);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }
}
