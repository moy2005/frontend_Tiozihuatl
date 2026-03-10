import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CalendarService } from '../../api/services/calendar.service';
import { UserProfileService } from '../../api/services/user-profile.service';
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

  constructor(
    private calendarService: CalendarService,
    private userService: UserProfileService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.verificarRol();
  }

  private verificarRol(): void {
    const token = localStorage.getItem('accessToken');
    if (token) {
      this.userService.getProfile().subscribe({
        next: (user: any) => {
          this.esDocente = user?.rol === 'Docente';
          this.cargarCalendario();
        },
        error: () => this.cargarCalendario()
      });
    } else {
      this.cargarCalendario();
    }
  }

  private cargarCalendario(): void {
    const handler = {
      next: (res: any) => {
        this.calendario = res;
        if (res?.archivo_url) {
          this.safeUrl = this.buildSafeUrl(res.archivo_url, res.tipo_archivo);
        }
      },
      error: (err: any) => console.error('Error cargando calendario', err)
    };

    if (this.esDocente) {
      this.calendarService.getCalendarDocente().subscribe(handler);
    } else {
      this.calendarService.getCalendarPublic('ALUMNO').subscribe(handler);
    }
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
