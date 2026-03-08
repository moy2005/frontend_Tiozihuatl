import { Component, OnInit, ViewEncapsulation,CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { HelpService } from '../../../api/services/help.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-gestion-faq',
  standalone: true,
  imports: [CommonModule, FormsModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './gestion-faq.html',
  styleUrls: ['./gestion-faq.css'],
  encapsulation: ViewEncapsulation.None
})
export class GestionFaqComponent implements OnInit {
  faqs: any[] = [];
  cargando = false;
  guardando = false;
  editando = false;
  mostrarModal = false;
  mostrarDetalles = false;
  faqSeleccionado: any = null;

  faqForm: any = {
    id_faq: null,
    pregunta: '',
    respuesta: '',
    estado: 'Activo'
  };

  constructor(private helpService: HelpService) {}

  ngOnInit() {
    this.cargarFaqs();
  }

  /** 📄 Cargar FAQ */
  async cargarFaqs() {
    this.cargando = true;
    try {
      const res: any = await firstValueFrom(this.helpService.getAllAdmin());

      console.log('Raw response:', res);
      console.log('Response type:', typeof res);
      console.log('Is array?', Array.isArray(res));

      // ✅ MANEJO MEJORADO: Detecta si el backend devuelve un objeto único por error
      if (Array.isArray(res)) {
        // Caso ideal: array de FAQs
        this.faqs = res;
      } else if (res && typeof res === 'object') {
        // Si es un objeto único (error del backend)
        if (res.id_faq) {
          // Es una FAQ única, convertir a array
          console.warn('⚠️ Backend devolvió un objeto único. Deberías corregir el controlador.');
          this.faqs = [res];
        } else if (res.data && Array.isArray(res.data)) {
          // Está envuelto en {data: [...]}
          this.faqs = res.data;
        } else {
          // Intentar convertir a array si tiene propiedades
          this.faqs = Object.keys(res).length > 0 ? [res] : [];
        }
      } else {
        this.faqs = [];
      }

      console.log('✅ FAQs procesadas:', this.faqs.length, this.faqs);

      // ⚠️ ALERTA si solo hay 1 FAQ cuando el backend debería devolver más
      if (this.faqs.length === 1) {
        console.warn('⚠️ Solo se cargó 1 FAQ. Verifica que el backend esté devolviendo un array completo.');
      }

    } catch (err) {
      console.error('❌ Error al cargar FAQs:', err);
      Swal.fire('Error', 'No se pudieron cargar las preguntas.', 'error');
      this.faqs = [];
    } finally {
      this.cargando = false;
    }
  }

  /** 👁️ Ver Detalles */
  verDetalles(faq: any) {
    this.faqSeleccionado = { ...faq };
    this.mostrarDetalles = true;
  }

  /** ❌ Cerrar Detalles */
  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.faqSeleccionado = null;
  }

  /** ➕ Nuevo */
  nuevoFaq() {
    this.editando = false;
    this.mostrarModal = true;
    this.faqForm = {
      id_faq: null,
      pregunta: '',
      respuesta: '',
      estado: 'Activo'
    };
  }

  /** ✏️ Editar */
  editarFaq(faq: any) {
    this.editando = true;
    this.mostrarModal = true;
    this.faqForm = { ...faq };
  }

  /** 💾 Guardar */
  async guardarFaq() {
    if (!this.faqForm.pregunta?.trim() || !this.faqForm.respuesta?.trim()) {
      Swal.fire(
        'Campos obligatorios',
        'La pregunta y la respuesta no pueden estar vacías.',
        'warning'
      );
      return;
    }

    this.guardando = true;

    try {
      if (this.faqForm.id_faq) {
        await firstValueFrom(
          this.helpService.updateFaq(this.faqForm.id_faq, this.faqForm)
        );
        Swal.fire('¡Actualizado!', 'Pregunta actualizada correctamente.', 'success');
      } else {
        await firstValueFrom(this.helpService.createFaq(this.faqForm));
        Swal.fire('¡Creado!', 'Pregunta creada correctamente.', 'success');
      }

      this.cerrarModal();
      this.cargarFaqs();
    } catch (error) {
      console.error('Error al guardar:', error);
      Swal.fire('Error', 'No se pudo guardar la pregunta.', 'error');
    } finally {
      this.guardando = false;
    }
  }

  /** 🗑️ Eliminar */
  async eliminarFaq(id: number) {
    const result = await Swal.fire({
      title: '¿Eliminar pregunta?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      this.cargando = true;
      try {
        await firstValueFrom(this.helpService.deleteFaq(id));
        Swal.fire('¡Eliminado!', 'La pregunta ha sido eliminada.', 'success');
        this.cargarFaqs();
      } catch (error) {
        console.error('Error al eliminar:', error);
        Swal.fire('Error', 'No se pudo eliminar la pregunta.', 'error');
      } finally {
        this.cargando = false;
      }
    }
  }

  /** ❌ Cerrar modal */
  cerrarModal() {
    this.mostrarModal = false;
    this.editando = false;
    this.guardando = false;
    this.faqForm = {
      id_faq: null,
      pregunta: '',
      respuesta: '',
      estado: 'Activo'
    };
  }

  /** ❌ Cancelar */
  cancelar() {
    if (this.faqForm.pregunta?.trim() || this.faqForm.respuesta?.trim()) {
      Swal.fire({
        title: '¿Descartar cambios?',
        text: 'Los cambios no guardados se perderán.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#6B7280',
        cancelButtonColor: '#2563EB',
        confirmButtonText: 'Sí, descartar',
        cancelButtonText: 'Seguir editando'
      }).then((result) => {
        if (result.isConfirmed) {
          this.cerrarModal();
        }
      });
    } else {
      this.cerrarModal();
    }
  }
}