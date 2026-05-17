import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from '../../../../app/api/environments/environment.prod';

interface SeccionTermino {
  id: number;
  numero: number;
  titulo: string;
  subtitulo?: string;
  contenido: string; 
  orden: number;
}

interface TerminosResponse {
  secciones: SeccionTermino[];
  ultima_actualizacion: string | null;
}

@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './terminos.html',
  styleUrl: './terminos.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Terminos implements OnInit {

  secciones: SeccionTermino[] = [];
  cargando = true;
  ultimaActualizacion = '';

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.http.get<TerminosResponse>(`${environment.apiUrl}/terminos`)
      .subscribe({
        next: (res) => {
          this.secciones = res.secciones;
          this.ultimaActualizacion = this.formatearFecha(res.ultima_actualizacion);
          this.cargando = false;
        },
        error: () => { this.cargando = false; }
      });
  }


  safeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  private formatearFecha(fecha: string | null): string {
    if (!fecha) return 'Sin registros aún';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long'
    });
  }
}