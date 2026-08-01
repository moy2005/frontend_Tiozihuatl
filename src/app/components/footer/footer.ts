import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ContactService } from '../../api/services/contact.service';

interface RouteLink { label: string; path: string; }
interface PublicRoutes {
  institucional: RouteLink[];
  servicios: RouteLink[];
  legal: RouteLink[];
  academico: RouteLink[];
}
interface ContactInfo {
  telefono: string;
  correo: string;
  direccion: string;
  horario: string;
  facebook: string;
  instagram: string;
  twitter: string;
  whatsapp: string;
  estado?: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class Footer implements OnInit {
  currentYear = new Date().getFullYear();
  cargandoContacto = false;
  contacto: ContactInfo = {
    telefono: '', correo: '', direccion: '', horario: '',
    facebook: '', instagram: '', twitter: '', whatsapp: '',
  };

  publicRoutes: PublicRoutes = {
    institucional: [
      { label: 'Inicio', path: '/inicio' },
      { label: 'Quiénes somos', path: '/about' },
      { label: 'Noticias', path: '/noticias' },
      { label: 'Contáctanos', path: '/contactanos' },
      { label: 'Calendario', path: '/calendario' },
    ],
    servicios: [
      { label: 'Catálogo bibliográfico', path: '/catalogo' },
      { label: 'Revistas digitales', path: '/magazines' },
    ],
    legal: [
      { label: 'Aviso de privacidad', path: '/privacidad' },
      { label: 'Términos de uso', path: '/terminos' },
      { label: 'Seguridad', path: '/seguridad' },
    ],
    academico: [
      { label: 'Iniciar sesión', path: '/login' },
      { label: 'Registrarse', path: '/register' },
      { label: 'Mi perfil', path: '/perfil' },
      { label: 'Mis compras', path: '/my-purchases' },
      { label: 'Carrito', path: '/cart' },
    ],
  };

  constructor(
    private contactService: ContactService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarContacto();
  }

  async cargarContacto(): Promise<void> {
    this.cargandoContacto = true;
    try {
      const res: any = await firstValueFrom(this.contactService.getPublicContactInfo());
      const data = res && typeof res === 'object' ? res : {};
      if (data.estado === 'Activo') {
        this.contacto = {
          telefono: data.telefono ?? '',
          correo: data.correo ?? '',
          direccion: data.direccion ?? '',
          horario: data.horario ?? '',
          facebook: data.facebook ?? '',
          instagram: data.instagram ?? '',
          twitter: data.twitter ?? '',
          whatsapp: data.whatsapp ?? '',
        };
      }
    } catch (err) {
      console.error('[Footer]', err);
    } finally {
      this.cargandoContacto = false;
      this.cdr.detectChanges();
    }
  }

  normalizePhone(phone: string): string {
    return phone ? phone.replace(/\D/g, '') : '';
  }
}
