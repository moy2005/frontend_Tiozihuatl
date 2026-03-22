import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CalendarService } from '../../api/services/calendar.service';
import { UserProfileService } from '../../api/services/user-profile.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendario.component.html',
  styleUrls: ['./calendario.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CalendarioComponent implements OnInit {

  calendario: any = null;
  esDocente = false;
  safeUrl: SafeResourceUrl | null = null;
  cargando = true; 

  constructor(
    private calendarService: CalendarService,
    private userService: UserProfileService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.inicializar();
  }

  private inicializar(): void {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      // Sin sesión: carga directa, sin overhead de perfil
      this.cargarCalendarioPorTipo(false);
      return;
    }

    const rolLocal = this.getRolFromToken(token);

    if (rolLocal !== null) {
      this.esDocente = rolLocal === 'Docente';
      this.cargarCalendarioPorTipo(this.esDocente);
    } else {
      forkJoin({
        perfil: this.userService.getProfile().pipe(catchError(() => of(null))),
      }).subscribe(({ perfil }) => {
        this.esDocente = perfil?.rol === 'Docente';
        this.cargarCalendarioPorTipo(this.esDocente);
      });
    }
  }

  private getRolFromToken(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.rol ?? null;
    } catch {
      return null;
    }
  }

  private cargarCalendarioPorTipo(esDocente: boolean): void {
    const peticion$ = esDocente
      ? this.calendarService.getCalendarDocente()
      : this.calendarService.getCalendarPublic('ALUMNO');

    peticion$.subscribe({
      next: (res: any) => {
        this.calendario = res;
        if (res?.archivo_url) {
          this.safeUrl = this.buildSafeUrl(res.archivo_url, res.tipo_archivo);
        }
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error cargando calendario', err);
        this.cargando = false;
      }
    });
  }

  private buildSafeUrl(url: string, tipo: string): SafeResourceUrl {
    const finalUrl = tipo === 'PDF'
      ? `${url}#toolbar=0&navpanes=0&view=FitH`
      : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(finalUrl);
  }

  descargarArchivo(): void {
    fetch(this.calendario.archivo_url)
      .then(res => res.blob())
      .then(blob => {
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = this.calendario.titulo.replace(/\s+/g, '_').toLowerCase()
          + (this.calendario.tipo_archivo === 'PDF' ? '.pdf' : '.jpg');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(objectUrl);

        Swal.fire({
          icon: 'success',
          title: 'Descarga iniciada',
          text: 'El calendario se está descargando correctamente.',
          timer: 1500,
          showConfirmButton: false
        });
      })
      .catch(() => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo descargar el archivo.'
        });
      });
  }
}
