import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {AdminTerminosService, SeccionTermino} from '../../../api/services/admin.terminos.service';

@Component({
  selector: 'app-gestion-terminos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-terminos.component.html',
  styleUrls: ['./gestion-terminos.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionTerminosComponent implements OnInit {

  @ViewChild('richEditor') richEditorRef!: ElementRef<HTMLDivElement>;

  secciones: SeccionTermino[] = [];
  cargando      = false;
  cargandoTabla = false;
  mostrarModal  = false;
  modoEdicion   = false;
  editandoId: number | null = null;

  form: SeccionTermino = this.formVacio();

  constructor(private svc: AdminTerminosService) {}

  ngOnInit(): void { this.cargar(); }

  // ── CARGAR ────────────────────────────────
  cargar(): void {
    this.cargandoTabla = true;
    this.svc.listar().subscribe({
      next: (res) => {
        this.secciones = res.map(s => ({
          ...s,
          activo: Number(s.activo) === 1 ? 1 : 0
        }));
        this.cargandoTabla = false;
      },
      error: () => {
        this.cargandoTabla = false;
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las secciones.', confirmButtonColor: '#3FA6E8' });
      }
    });
  }

  // ── MODAL ────────────────────────────────
  abrirModal(): void {
    this.form = this.formVacio();
    this.modoEdicion = false;
    this.editandoId = null;
    this.mostrarModal = true;
    // Limpiar editor después de que el DOM se renderice
    setTimeout(() => { this.setEditorContent(''); }, 50);
  }

  editarSeccion(s: SeccionTermino): void {
    this.form = { ...s };
    this.modoEdicion = true;
    this.editandoId = s.id!;
    this.mostrarModal = true;
    // Cargar contenido HTML en el editor
    setTimeout(() => { this.setEditorContent(s.contenido || ''); }, 50);
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.form = this.formVacio();
  }

  // ── GUARDAR ───────────────────────────────
  guardar(): void {
    if (!this.form.titulo?.trim() || !this.form.contenido?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'El título y el contenido son obligatorios.', confirmButtonColor: '#3FA6E8' });
      return;
    }

    this.cargando = true;

    const accion = this.modoEdicion
      ? this.svc.actualizar(this.editandoId!, this.form)
      : this.svc.crear(this.form);

    accion.subscribe({
      next: () => {
        this.cargando = false;
        this.cerrarModal();
        this.cargar();
        Swal.fire({
          icon: 'success',
          title: this.modoEdicion ? '¡Actualizado!' : '¡Creado!',
          text: `La sección fue ${this.modoEdicion ? 'actualizada' : 'registrada'} correctamente.`,
          confirmButtonColor: '#3FA6E8',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: () => {
        this.cargando = false;
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar la sección.', confirmButtonColor: '#3FA6E8' });
      }
    });
  }

  // ── ESTADO ────────────────────────────────
  cambiarEstado(s: SeccionTermino): void {
    const nuevo     = s.activo === 1 ? 0 : 1;
    const accion    = nuevo === 1 ? 'activar' : 'desactivar';
    const accionPas = nuevo === 1 ? 'activada' : 'desactivada';

    Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} sección?`,
      text: `La sección "${s.titulo}" será ${accionPas}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: nuevo === 1 ? '#4CAF50' : '#F44336',
      cancelButtonColor: '#607D8B'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.svc.cambiarEstado(s.id!, nuevo).subscribe({
        next: () => { s.activo = nuevo; },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el estado.', confirmButtonColor: '#3FA6E8' })
      });
    });
  }

  // ── ELIMINAR ─────────────────────────────
  eliminar(s: SeccionTermino): void {
    Swal.fire({
      title: '¿Eliminar sección?',
      html: `La sección <strong>"${s.titulo}"</strong> será eliminada permanentemente.<br><small style="color:#94A3B8">Esta acción no se puede deshacer.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#F44336',
      cancelButtonColor: '#607D8B'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.svc.eliminar(s.id!).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Sección eliminada', timer: 2000, showConfirmButton: false });
        },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar.', confirmButtonColor: '#3FA6E8' })
      });
    });
  }


  private get editor(): HTMLDivElement | null {
    return this.richEditorRef?.nativeElement ?? null;
  }

  private setEditorContent(html: string): void {
    if (this.editor) {
      this.editor.innerHTML = html;
      this.form.contenido = html;
    }
  }

  onEditorInput(): void {
    if (this.editor) {
      this.form.contenido = this.editor.innerHTML;
    }
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  }

  /** Wrapper para execCommand estándar */
  execFormat(command: string, value?: string): void {
    document.execCommand(command, false, value);
    this.editor?.focus();
    this.onEditorInput();
  }

  formatHeading(): void {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

    const block = (node as HTMLElement).closest?.('h3, p, div');
    if (block && block.tagName === 'H3') {
      document.execCommand('formatBlock', false, 'p');
    } else {
      document.execCommand('formatBlock', false, 'h3');
    }
    this.editor?.focus();
    this.onEditorInput();
  }

  toggleList(ordered: boolean): void {
    const cmd = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(cmd, false);
    this.editor?.focus();
    this.onEditorInput();
  }

  private formVacio(): SeccionTermino {
    return { numero: 1, titulo: '', subtitulo: '', contenido: '', orden: 0 };
  }
}