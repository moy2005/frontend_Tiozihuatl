import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { MaintenanceService } from '../../../api/services/maintenance.service';
import { AutomationService } from '../../../api/services/automation.service';

@Component({
  selector: 'app-gestion-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-maintenance.html',
  styleUrls: ['./gestion-maintenance.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class GestionMantenimientoComponent implements OnInit {

  ejecutando        = false;
  cargandoStatus    = false;
  cargandoLogs      = false;
  cargandoProgramar = false;
  cargandoTareas    = false;
  status: any       = null;
  logs: any[]       = [];
  tareas: any[]     = [];
  logDetalle: any   = null;
  mostrarModal      = false;
  cargandoDetalle   = false;
  tipoFrecuencia     = 'weekly';
  horaInicio         = '02:00';
  intervaloHoras     = 6;
  diasSeleccionados: number[] = [];
  tablasDetectadas: string[] = [];
  cargandoTablas = false;

   // ── Filtros historial ─────────────────────────────────────────
  filtroBusqueda  = '';
  filtroOrigen    = 'todos'; 

  opcionesFrecuencia = [
    { value: 'weekly',   label: 'Una vez a la semana', icon: 'calendar-outline'  },
    { value: 'daily',    label: 'Una vez al día',      icon: 'sunny-outline'     },
    { value: 'interval', label: 'Cada varias horas',   icon: 'hourglass-outline' },
    { value: 'days',     label: 'Días específicos',    icon: 'calendar-number-outline' }
  ];

  dias = [
    { label: 'Lun', value: 1 },
    { label: 'Mar', value: 2 },
    { label: 'Mié', value: 3 },
    { label: 'Jue', value: 4 },
    { label: 'Vie', value: 5 },
    { label: 'Sáb', value: 6 },
    { label: 'Dom', value: 0 }
  ];

  constructor(
    private maintenanceService: MaintenanceService,
    private automationService: AutomationService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.cargarStatus(),
      this.cargarLogs(),
      this.cargarTareas(),
      this.cargarTablasDetectadas()
    ]);
  }

  // ── Ejecutar mantenimiento manual ─────────────────────────────
  async ejecutarMantenimiento(): Promise<void> {
    const confirm = await Swal.fire({
  title: '¿Ejecutar optimización?',
  html: `El sistema detectó <b>${this.tablasDetectadas.length} tablas</b> 
         que requieren mantenimiento.<br><br>Este proceso puede tardar unos segundos.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, ejecutar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2196F3'
    });
    if (!confirm.isConfirmed) return;

    this.ejecutando = true;
    try {
      const res: any = await firstValueFrom(
        this.maintenanceService.runMaintenance()
      );
      await Swal.fire({
        title: 'Optimización completada',
        html: `
          <div style="text-align:left; font-size:0.9rem; line-height:2">
            <b>Tablas procesadas:</b> ${res.tablas_procesadas}<br>
            <b>Exitosas:</b> ${res.tablas_ok}<br>
            <b>Con error:</b> ${res.tablas_error}<br>
            <b>Duración:</b> ${res.duracion_seg}s
          </div>`,
        icon: res.tablas_error === 0 ? 'success' : 'warning'
      });
      await Promise.all([this.cargarStatus(), this.cargarLogs()]);
    } catch {
      Swal.fire('Error', 'No se pudo ejecutar la optimización.', 'error');
    } finally {
      this.ejecutando = false;
    }
  }

  async cargarTablasDetectadas(): Promise<void> {
    this.cargandoTablas = true;
    try {
      const res: any = await firstValueFrom(
        this.maintenanceService.getTablasDetectadas()
      );
      this.tablasDetectadas = res.tablas ?? [];
    } catch (e) { console.error(e); }
    finally { this.cargandoTablas = false; }
  }

  // ── Cargar estado ────────────────────────────────────
  async cargarStatus(): Promise<void> {
    this.cargandoStatus = true;
    try {
      this.status = await firstValueFrom(this.maintenanceService.getStatus());
    } catch (e) { console.error(e); }
    finally { this.cargandoStatus = false; }
  }

  async cargarLogs(): Promise<void> {
    this.cargandoLogs = true;
    try {
      this.logs = await firstValueFrom(this.maintenanceService.getLogs()) as any[];
    } catch (e) { console.error(e); }
    finally { this.cargandoLogs = false; }
  }

  // ── Ver detalle de una ejecución ──────────────────────────────
  async verDetalle(log: any): Promise<void> {
    this.cargandoDetalle = true;
    this.mostrarModal    = true;
    try {
      this.logDetalle = await firstValueFrom(
        this.maintenanceService.getLogDetail(log.id_log)
      );
    } catch (e) { console.error(e); }
    finally { this.cargandoDetalle = false; }
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.logDetalle   = null;
  }

  // ── Tareas programadas ────────────────────────────────────────
  async cargarTareas(): Promise<void> {
    this.cargandoTareas = true;
    try {
      const data: any = await firstValueFrom(this.automationService.getTasks());
      this.tareas = (data as any[]).filter(t => t.tipo_tarea === 'maintenance_db');
    } catch (e) { console.error(e); }
    finally { this.cargandoTareas = false; }
  }

  async programarMantenimiento(): Promise<void> {
    if (this.tipoFrecuencia === 'interval' && this.intervaloHoras < 2) {
      Swal.fire('Intervalo inválido', 'El mínimo es 2 horas.', 'warning');
      return;
    }
    if (this.tipoFrecuencia === 'days' && this.diasSeleccionados.length === 0) {
      Swal.fire('Selecciona los días', 'Debes elegir al menos un día.', 'warning');
      return;
    }
    this.cargandoProgramar = true;
    try {
      await firstValueFrom(this.automationService.createBackupTask({
        nombre_tarea:    'Optimización automática de BD',
        tipo_tarea:      'maintenance_db',
        cron_expression: this.generarCron()
      }));
      Swal.fire('Programación guardada',
        'La optimización automática fue configurada correctamente.', 'success');
      await this.cargarTareas();
    } catch (e: any) {
      Swal.fire('Error', e?.error?.message || 'No se pudo guardar.', 'error');
    } finally {
      this.cargandoProgramar = false;
    }
  }

  async toggleTask(id: number): Promise<void> {
    try {
      await firstValueFrom(this.automationService.toggleTask(id));
      await this.cargarTareas();
    } catch {
      Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
    }
  }

  async eliminarTarea(id: number): Promise<void> {
    const result = await Swal.fire({
      title: 'Eliminar programación',
      text: '¿Seguro que deseas eliminar esta programación?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#F44336'
    });
    if (!result.isConfirmed) return;
    try {
      await firstValueFrom(this.automationService.deleteTask(id));
      await this.cargarTareas();
    } catch {
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
  }

   // ── FILTROS ───────────────────────────────────────────────────
  get logsFiltrados(): any[] {
    return this.logs.filter(log => {
      const coincideOrigen = this.filtroOrigen === 'todos' || log.origen === this.filtroOrigen;
      const coincideBusqueda = this.filtroBusqueda === '' ||
        this.normalizarFecha(log.fecha).toLowerCase().includes(this.filtroBusqueda.toLowerCase()) ||
        this.calcularEstado(log).toLowerCase().includes(this.filtroBusqueda.toLowerCase()) ||
        String(log.tablas_ok).includes(this.filtroBusqueda) ||
        String(log.duracion_seg).includes(this.filtroBusqueda);
      return coincideOrigen && coincideBusqueda;
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  toggleDia(value: number): void {
    this.diasSeleccionados = this.diasSeleccionados.includes(value)
      ? this.diasSeleccionados.filter(d => d !== value)
      : [...this.diasSeleccionados, value];
  }

  calcularEstado(log: any): 'Exitoso' | 'Parcial' | 'Con errores' {
    if (log.tablas_error === 0)                          return 'Exitoso';
    if (log.tablas_error < log.tablas_procesadas)        return 'Parcial';
    return 'Con errores';
  }

  badgeEstado(log: any): string {
    const e = this.calcularEstado(log);
    if (e === 'Exitoso')     return 'badge-activo';
    if (e === 'Parcial')     return 'badge-manual';
    return 'badge-cancelado';
  }

  normalizarFecha(fecha: string | null): string {
    if (!fecha) return '';
    const str = fecha.replace('T', ' ');
    const [fechaParte, horaParte] = str.split(' ');
    const [anio, mes, dia] = fechaParte.split('-');
    const [hora, min] = horaParte.split(':');
    return `${dia}/${mes}/${anio}, ${hora}:${min}`;
  }

  describirCron(expr: string): string {
    if (!expr) return '—';
    const partes = expr.trim().split(/\s+/);
    if (partes.length < 5) return expr;
    const [min, hora, , , dias] = partes;
    if (hora.startsWith('*/')) return `Cada ${hora.replace('*/', '')} horas`;
    const horaFmt = `${String(Number(hora)).padStart(2,'0')}:${String(Number(min)).padStart(2,'0')}`;
    if (dias !== '*') {
      const nombres: Record<string,string> = {
        '0':'Dom','1':'Lun','2':'Mar','3':'Mié','4':'Jue','5':'Vie','6':'Sáb'
      };
      return `${dias.split(',').map(d => nombres[d]).join(', ')} a las ${horaFmt}`;
    }
    return `Todos los días a las ${horaFmt}`;
  }
 
  private generarCron(): string {
    const [h, m] = this.horaInicio.split(':').map(Number);
    if (this.tipoFrecuencia === 'weekly')   return `${m} ${h} * * 0`;
    if (this.tipoFrecuencia === 'daily')    return `${m} ${h} * * *`;
    if (this.tipoFrecuencia === 'interval') return `0 */${this.intervaloHoras} * * *`;
    if (this.tipoFrecuencia === 'days')     return `${m} ${h} * * ${this.diasSeleccionados.join(',')}`;
    throw new Error('Frecuencia inválida');
  }
  
}
