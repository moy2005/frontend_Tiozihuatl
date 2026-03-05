import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { BackupService } from '../../../api/services/backup.service';
import { AutomationService } from '../../../api/services/automation.service';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-gestion-backups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-backups.html',
  styleUrls: ['./gestion-backups.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class GestionBackupsComponent implements OnInit {

  // ----------------------------------------------------------------
  // ESTADOS DE CARGA
  // ----------------------------------------------------------------
  cargandoCompleto  = false;
  cargandoTabla     = false;
  cargandoProgramar = false;
  cargandoTareas    = false;
  cargandoHistorial = false;
  cargandoDescarga  = false;

  // ----------------------------------------------------------------
  // BACKUP POR TABLA
  // ----------------------------------------------------------------
  tablaSeleccionada = '';

  tablas: string[] = [
    'usuarios',
    'libros',
    'prestamos',
    'revistas',
    'compras',
    'detalle_compra',
    'pagos',
    'noticias',
    'materias'
  ];

  private etiquetas: Record<string, string> = {
    usuarios:       'Usuarios',
    libros:         'Libros',
    prestamos:      'Préstamos',
    revistas:       'Revistas',
    compras:        'Compras',
    detalle_compra: 'Detalle de Compras',
    pagos:          'Pagos',
    noticias:       'Noticias',
    materias:       'Materias'
  };

  etiquetaTabla(tabla: string | null): string {
    if (!tabla) return '—';
    return this.etiquetas[tabla] ?? tabla;
  }

  // ----------------------------------------------------------------
  // PROGRAMAR BACKUP
  // ----------------------------------------------------------------
  tipoFrecuencia  = 'daily';
  horaInicio      = '02:00';
  intervaloHoras  = 6;
  diasSeleccionados: number[] = [];

  opcionesFrecuencia = [
    { value: 'daily',    label: 'Una vez al día',    icon: 'sunny-outline'     },
    { value: 'interval', label: 'Cada varias horas', icon: 'hourglass-outline' },
    { value: 'days',     label: 'Días específicos',  icon: 'calendar-outline'  }
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

  // ----------------------------------------------------------------
  // FILTROS HISTORIAL
  // ----------------------------------------------------------------
  opcionesFiltroTipo = [
    { value: 'todos',      label: 'Todos',       icon: 'list-outline'      },
    { value: 'automatico', label: 'Automáticos', icon: 'flash-outline'     },
    { value: 'manual',     label: 'Manuales',    icon: 'hand-left-outline' }
  ];

  filtroTipo      = 'todos';
  filtroHistorial = '';

  // ----------------------------------------------------------------
  // DATOS
  // ----------------------------------------------------------------
  tareas:            any[] = [];
  historialCompleto: any[] = [];
  historialFiltrado: any[] = [];

  // ----------------------------------------------------------------
  // CONSTRUCTOR + INIT
  // ----------------------------------------------------------------
  constructor(
    private backupService: BackupService,
    private automationService: AutomationService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.cargarTareas(),
      this.cargarHistorial()
    ]);
  }

  // ----------------------------------------------------------------
  // UTILIDADES
  // ----------------------------------------------------------------

  private descargarArchivo(blob: Blob, nombre: string): void {
    const url = window.URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  toggleDia(value: number): void {
    if (this.diasSeleccionados.includes(value)) {
      this.diasSeleccionados = this.diasSeleccionados.filter(d => d !== value);
    } else {
      this.diasSeleccionados = [...this.diasSeleccionados, value];
    }
  }


describirCron(expr: string): string {
  if (!expr) return '—';
  const partes = expr.trim().split(/\s+/);
  if (partes.length < 5) return expr;

  const min      = partes[0];
  const hora     = partes[1];
  const diasExpr = partes[4];

  if (hora.startsWith('*/')) {
    const h = hora.replace('*/', '');
    return `Cada ${h} hora${Number(h) !== 1 ? 's' : ''}`;
  }

  // Convertir UTC a hora local
  const fechaUTC = new Date();
  fechaUTC.setUTCHours(Number(hora), Number(min), 0, 0);
  const horaLocal = fechaUTC.getHours();
  const minLocal  = fechaUTC.getMinutes();
  const horaFmt   = `${String(horaLocal).padStart(2, '0')}:${String(minLocal).padStart(2, '0')}`;

  if (diasExpr !== '*') {
    const nombresDias: Record<string, string> = {
      '0': 'Dom', '1': 'Lun', '2': 'Mar',
      '3': 'Mié', '4': 'Jue', '5': 'Vie', '6': 'Sáb'
    };
    const nombres = diasExpr.split(',').map(d => nombresDias[d] ?? d).join(', ');
    return `${nombres} a las ${horaFmt}`;
  }

  return `Todos los días a las ${horaFmt}`;
}

  // ----------------------------------------------------------------
  // GENERADOR CRON (interno)
  // ----------------------------------------------------------------

private generarCron(): string {
  const partes = this.horaInicio.split(':');
  let h = parseInt(partes[0]);
  const m = parseInt(partes[1]);

  // Convertir hora local a UTC
  const fecha = new Date();
  fecha.setHours(h, m, 0, 0);
  const hUTC = fecha.getUTCHours();
  const mUTC = fecha.getUTCMinutes();

  if (this.tipoFrecuencia === 'daily') {
    return `${mUTC} ${hUTC} * * *`;
  }
  if (this.tipoFrecuencia === 'interval') {
    if (this.intervaloHoras < 2) throw new Error('Intervalo inválido');
    return `0 */${this.intervaloHoras} * * *`;
  }
  if (this.tipoFrecuencia === 'days') {
    if (this.diasSeleccionados.length === 0) throw new Error('Sin días seleccionados');
    return `${mUTC} ${hUTC} * * ${this.diasSeleccionados.join(',')}`;
  }
  throw new Error('Frecuencia inválida');
}

  // ----------------------------------------------------------------
  // BACKUP COMPLETO
  // ----------------------------------------------------------------

  async backupCompleto(): Promise<void> {
    this.cargandoCompleto = true;
    try {
      const response = await firstValueFrom(this.backupService.backupDatabase());
      const blob     = response.body as Blob;
      const cd       = response.headers.get('content-disposition');
      const fileName = cd?.split('filename=')[1]?.replace(/"/g, '') || 'backup.sql';
      this.descargarArchivo(blob, fileName);
      Swal.fire('Respaldo generado', 'El archivo fue descargado correctamente.', 'success');
      await this.cargarHistorial();
    } catch {
      Swal.fire('Error', 'No se pudo generar el respaldo.', 'error');
    } finally {
      this.cargandoCompleto = false;
    }
  }

  // ----------------------------------------------------------------
  // BACKUP POR TABLA
  // ----------------------------------------------------------------

  async backupTabla(): Promise<void> {
    if (!this.tablaSeleccionada) {
      Swal.fire('Selecciona una sección', 'Debes elegir una sección del sistema.', 'warning');
      return;
    }
    this.cargandoTabla = true;
    try {
      const response = await firstValueFrom(
        this.backupService.backupTable(this.tablaSeleccionada)
      );
      const blob     = response.body as Blob;
      const cd       = response.headers.get('content-disposition');
      const fileName = cd?.split('filename=')[1]?.replace(/"/g, '') || 'backup.sql';
      this.descargarArchivo(blob, fileName);
      Swal.fire(
        'Respaldo generado',
        `Sección "${this.etiquetaTabla(this.tablaSeleccionada)}" respaldada correctamente.`,
        'success'
      );
      await this.cargarHistorial();
    } catch {
      Swal.fire('Error', 'No se pudo generar el respaldo.', 'error');
    } finally {
      this.cargandoTabla = false;
    }
  }

  // ----------------------------------------------------------------
  // DESCARGA DESDE CLOUDINARY
  // ----------------------------------------------------------------

  async descargarBackupAutomatico(backup: any): Promise<void> {
    this.cargandoDescarga = true;
    try {
      const response = await firstValueFrom(
        this.backupService.downloadFromUrl(backup.url_backup)
      );
      const blob = response.body as Blob;
      this.descargarArchivo(blob, backup.nombre_archivo);
    } catch {
      Swal.fire('Error', 'No se pudo descargar el respaldo.', 'error');
    } finally {
      this.cargandoDescarga = false;
    }
  }

  // ----------------------------------------------------------------
  // PROGRAMAR BACKUP
  // ----------------------------------------------------------------

  async programarBackup(): Promise<void> {
    if (this.tipoFrecuencia === 'interval' && this.intervaloHoras < 2) {
      Swal.fire('Intervalo inválido', 'El mínimo es 2 horas.', 'warning');
      return;
    }
    if (this.tipoFrecuencia === 'days' && this.diasSeleccionados.length === 0) {
      Swal.fire('Selecciona los días', 'Debes elegir al menos un día de la semana.', 'warning');
      return;
    }

    this.cargandoProgramar = true;
    try {
      const cronExpression = this.generarCron();
      await firstValueFrom(
        this.automationService.createBackupTask({
          nombre_tarea:    'Respaldo automático',
          tipo_tarea:      'backup_database',
          cron_expression: cronExpression
        })
      );
      Swal.fire(
        'Programación guardada',
        'El respaldo automático fue configurado correctamente.',
        'success'
      );
      await this.cargarTareas();
    } catch (e: unknown) {
      console.error(e);

      let mensaje = 'Error';

      if (e instanceof HttpErrorResponse) {
        mensaje = e.error?.message || e.message;
      }

      Swal.fire('Error', mensaje, 'error');
    } finally {
      this.cargandoProgramar = false;
    }
  }

  // ----------------------------------------------------------------
  // TAREAS PROGRAMADAS
  // ----------------------------------------------------------------

  async cargarTareas(): Promise<void> {
    this.cargandoTareas = true;
    try {
      const data: any = await firstValueFrom(this.automationService.getTasks());
      this.tareas = (data as any[]).filter(t => t.tipo_tarea === 'backup_database');
    } catch (e) {
      console.error(e);
    } finally {
      this.cargandoTareas = false;
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
      title:              'Eliminar programación',
      text:               '¿Seguro que deseas eliminar esta programación?',
      icon:               'warning',
      showCancelButton:   true,
      confirmButtonText:  'Sí, eliminar',
      cancelButtonText:   'Cancelar',
      confirmButtonColor: '#F44336'
    });

    if (!result.isConfirmed) return;

    try {
      await firstValueFrom(this.automationService.deleteTask(id));
      await this.cargarTareas();
    } catch {
      Swal.fire('Error', 'No se pudo eliminar la programación.', 'error');
    }
  }

  // ----------------------------------------------------------------
  // HISTORIAL
  // ----------------------------------------------------------------

  async cargarHistorial(): Promise<void> {
    this.cargandoHistorial = true;
    try {
      const data: any = await firstValueFrom(this.backupService.getBackupHistory());
      this.historialCompleto = data as any[];
      this.aplicarFiltroHistorial();
    } catch (e) {
      console.error(e);
    } finally {
      this.cargandoHistorial = false;
    }
  }

  aplicarFiltroHistorial(): void {
    let resultado = [...this.historialCompleto];

    if (this.filtroTipo !== 'todos') {
      resultado = resultado.filter(b => b.tipo === this.filtroTipo);
    }

    const q = this.filtroHistorial.trim().toLowerCase();
    if (q) {
      resultado = resultado.filter(b =>
        (b.nombre_archivo as string)?.toLowerCase().includes(q)
      );
    }

    this.historialFiltrado = resultado;
  }

}