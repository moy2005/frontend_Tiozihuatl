import { Component, OnInit, ViewEncapsulation, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ContactService } from '../../api/services/contact.service';
import { firstValueFrom } from 'rxjs';

interface ContactInfo {
  telefono: string;
  correo: string;
  direccion: string;
  horario: string;
  facebook: string;
  instagram: string;
  twitter: string;
  whatsapp: string;
  latitud?: number;
  longitud?: number;
  estado?: string;
}

@Component({
  selector: 'app-contactanos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contactanos.html',
  styleUrls: ['./contactanos.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ContactanosComponent implements OnInit {
  @ViewChild('mapSection') mapSection!: ElementRef;

  cargando = false;
  mostrarContacto = false;

  // ============================================
  // CONFIGURACIÓN DEL MAPA - EDITAR AQUÍ
  // ============================================
  // Coordenadas de la institución
  // Para obtenerlas: Ve a Google Maps, haz clic derecho en la ubicación y copia las coordenadas
  mapLatitud: number | null = 21.1395641;
  mapLongitud: number | null = -98.4218688;
  // ============================================

  contacto: ContactInfo = {
    telefono: '',
    correo: '',
    direccion: '',
    horario: '',
    facebook: '',
    instagram: '',
    twitter: '',
    whatsapp: '',
    latitud: undefined,
    longitud: undefined
  };

  constructor(
    private contactService: ContactService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.cargarContacto();
  }

  async cargarContacto(): Promise<void> {
    this.cargando = true;
    try {
      const res: any = await firstValueFrom(
        this.contactService.getPublicContactInfo()
      );

      console.log('CONTACT PUBLIC RAW:', res);

      // Normalización segura
      const data = res && typeof res === 'object' ? res : {};
      
      this.mostrarContacto = data.estado === 'Activo';

      if (this.mostrarContacto) {
        this.contacto = {
          telefono: data.telefono ?? '',
          correo: data.correo ?? '',
          direccion: data.direccion ?? '',
          horario: data.horario ?? '',
          facebook: data.facebook ?? '',
          instagram: data.instagram ?? '',
          twitter: data.twitter ?? '',
          whatsapp: data.whatsapp ?? '',
          // NO usamos latitud/longitud de la BD
          latitud: undefined,
          longitud: undefined
        };
      }

    } catch (err) {
      console.error('Error al cargar contacto:', err);
      this.mostrarContacto = false;
    } finally {
      this.cargando = false;
    }
  }

  /**
   * Genera la URL del mapa de Google Maps embebido
   */
  getMapUrl(): SafeResourceUrl {
    if (!this.mapLatitud || !this.mapLongitud) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('');
    }

    const lat = this.mapLatitud;
    const lng = this.mapLongitud;
    
    // URL para iframe de Google Maps (gratuito)
    const url = `https://www.google.com/maps?q=${lat},${lng}&hl=es&z=15&output=embed`;
    
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * Genera la URL para abrir direcciones en Google Maps
   */
  getDirectionsUrl(): string {
    if (!this.mapLatitud || !this.mapLongitud) {
      return '#';
    }

    const lat = this.mapLatitud;
    const lng = this.mapLongitud;
    
    // URL para abrir Google Maps con direcciones
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  /**
   * Verifica si hay coordenadas configuradas
   */
  hasMapCoordinates(): boolean {
    return this.mapLatitud !== null && this.mapLongitud !== null;
  }

  /**
   * Hacer scroll suave hacia el mapa
   */
  scrollToMap(): void {
    if (this.mapSection) {
      this.mapSection.nativeElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }

  /**
   * Normalizar número de WhatsApp
   */
  private normalizeWhatsApp(whatsapp: string): string {
    if (!whatsapp) return '';
    
    // Remover todos los caracteres que no sean números
    return whatsapp.replace(/\D/g, '');
  }
}