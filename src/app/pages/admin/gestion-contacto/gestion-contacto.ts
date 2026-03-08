import { Component, OnInit, ViewEncapsulation,CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ContactService } from '../../../api/services/contact.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-gestion-contacto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-contacto.html',
  styleUrls: ['./gestion-contacto.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class GestionContactoComponent implements OnInit {
  cargando = false;

  contacto: any = {
    telefono: '',
    correo: '',
    direccion: '',
    horario: '',
    facebook: '',
    instagram: '',
    twitter: '',
    whatsapp: '',
    estado: 'Activo'
  };

  constructor(private contactService: ContactService) {}

  ngOnInit() {
    this.cargarContacto();
  }
async cargarContacto() {
  this.cargando = true;
  try {
    const res: any = await firstValueFrom(
      this.contactService.getContactInfo()
    );

    console.log('CONTACT ADMIN RAW:', res);

    // Si NO hay registros, dejamos el formulario vacío (estado inicial)
    if (Array.isArray(res) && res.length === 0) {
      return;
    }

    const data = Array.isArray(res) ? res[0] : res;

    this.contacto = {
      telefono: data?.telefono ?? '',
      correo: data?.correo ?? '',
      direccion: data?.direccion ?? '',
      horario: data?.horario ?? '',
      facebook: data?.facebook ?? '',
      instagram: data?.instagram ?? '',
      twitter: data?.twitter ?? '',
      whatsapp: data?.whatsapp ?? '',
      estado: data?.estado ?? 'Activo'
    };

  } catch {
    Swal.fire('Error', 'No se pudo cargar la información.', 'error');
  } finally {
    this.cargando = false;
  }
}



  async guardar() {
    this.cargando = true;
    try {
      await firstValueFrom(
        this.contactService.saveContactInfo(this.contacto)
      );

      Swal.fire(
        'Guardado',
        'Información de contacto actualizada correctamente.',
        'success'
      );
    } catch {
      Swal.fire('Error', 'No se pudo guardar la información.', 'error');
    } finally {
      this.cargando = false;
    }
  }
}
