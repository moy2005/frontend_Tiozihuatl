import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import Swal from 'sweetalert2';
import { AdminPrivacidadService, SeccionPolitica } from '../../../api/services/admin-privacidad.service';

@Component({
  selector: 'app-gestion-privacidad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-privacidad.html',
  styleUrls: ['./gestion-privacidad.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionPrivacidadComponent implements OnInit {

  secciones: SeccionPolitica[] = [];
  cargandoTabla = false;
  cargando      = false;
  mostrarModal  = false;
  modoEdicion   = false;
  editandoId: number | null = null;

  filtros = { search: '', activo: '' };

  Math = Math;
  paginaActual   = 1;
  itemsPorPagina = 20;
  totalPaginas   = 0;

  form: SeccionPolitica = this.formVacio();

  @ViewChild('richEditor')
  set richEditorSetter(el: ElementRef<HTMLDivElement>) {
    if (el) {
      this._richEditor = el;
      if (this._pendingContent !== null) {
        el.nativeElement.innerHTML = this._pendingContent;
        this._pendingContent = null;
      }
    }
  }
  private _richEditor!: ElementRef<HTMLDivElement>;
  private _pendingContent: string | null = null;

  constructor(private svc: AdminPrivacidadService) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargandoTabla = true;
    this.svc.listar(this.filtros).subscribe({
      next: (data) => {
        this.secciones    = data;
        this.paginaActual = 1;
        this.calcularPaginas();
        this.cargandoTabla = false;
      },
      error: () => {
        this.cargandoTabla = false;
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las secciones.', confirmButtonColor: '#1976D2' });
      }
    });
  }

  // ── PAGINACIÓN ──
  get seccionesPaginadas(): SeccionPolitica[] {
    const ini = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.secciones.slice(ini, ini + this.itemsPorPagina);
  }
  calcularPaginas(): void {
    this.totalPaginas = Math.ceil(this.secciones.length / this.itemsPorPagina);
    if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) this.paginaActual = this.totalPaginas;
  }
  get paginas(): (number | string)[] {
    this.calcularPaginas();
    const total = this.totalPaginas, actual = this.paginaActual, delta = 2;
    const rango: number[] = [];
    for (let i = 1; i <= total; i++)
      if (i === 1 || i === total || (i >= actual - delta && i <= actual + delta)) rango.push(i);
    const result: (number | string)[] = [];
    let prev: number | null = null;
    for (const i of rango) { if (prev && i - prev !== 1) result.push('...'); result.push(i); prev = i; }
    return result;
  }
  irAPagina(p: number | string) { if (typeof p === 'number') this.paginaActual = p; }
  anterior()  { if (this.paginaActual > 1) this.paginaActual--; }
  siguiente() { if (this.paginaActual < this.totalPaginas) this.paginaActual++; }
  cambiarItems() { this.paginaActual = 1; this.calcularPaginas(); }

  // ── MODAL ──
  abrirModal(): void {
    this.modoEdicion     = false;
    this.editandoId      = null;
    this.form            = this.formVacio();
    this._pendingContent = '';        
    this.mostrarModal    = true;
  }

  editar(s: SeccionPolitica): void {
    this.modoEdicion     = true;
    this.editandoId      = s.id!;
    this.form            = { ...s };
    this._pendingContent = this.contentToEditorHtml(s.contenido || '');  
    this.mostrarModal    = true;
  }

  cerrar(): void {
    this.mostrarModal    = false;
    this.form            = this.formVacio();
    this.modoEdicion     = false;
    this.editandoId      = null;
    this._pendingContent = null;
  }

  // ── GUARDAR ──
  guardar(): void {
    if (this._richEditor?.nativeElement) {
      const html = this._richEditor.nativeElement.innerHTML;
      this.form.contenido = (html === '<br>' || html.replace(/<[^>]*>/g, '').trim() === '') ? '' : html;
    }

    if (!this.form.titulo?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'El título es obligatorio.', confirmButtonColor: '#1976D2' });
      return;
    }
    if (!this.form.contenido?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'El contenido es obligatorio.', confirmButtonColor: '#1976D2' });
      return;
    }

    this.cargando = true;
    const op$ = this.modoEdicion
      ? this.svc.actualizar(this.editandoId!, this.form)
      : this.svc.crear(this.form);

    op$.subscribe({
      next: () => {
        this.cargando = false;
        this.cerrar();
        this.cargar();
        Swal.fire({
          icon: 'success',
          title: this.modoEdicion ? '¡Actualizada!' : '¡Sección creada!',
          text:  this.modoEdicion ? 'La sección fue actualizada correctamente.' : 'La sección fue creada correctamente.',
          confirmButtonColor: '#1976D2', timer: 2000, showConfirmButton: false
        });
      },
      error: () => {
        this.cargando = false;
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar la sección.', confirmButtonColor: '#1976D2' });
      }
    });
  }

  cambiarEstado(s: SeccionPolitica): void {
    const nuevo     = s.activo === 1 ? 0 : 1;
    const accion    = nuevo === 1 ? 'activar'  : 'desactivar';
    const accionado = nuevo === 1 ? 'activada' : 'desactivada';
    Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} sección?`,
      text:  `La sección "${s.titulo}" será ${accionado}.`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`, cancelButtonText: 'Cancelar',
      confirmButtonColor: nuevo === 1 ? '#4CAF50' : '#F44336', cancelButtonColor: '#607D8B'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.svc.cambiarEstado(s.id!, nuevo).subscribe({
        next: () => { s.activo = nuevo; Swal.fire({ icon: 'success', title: `Sección ${accionado}`, timer: 1500, showConfirmButton: false }); },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el estado.', confirmButtonColor: '#1976D2' })
      });
    });
  }

  eliminar(s: SeccionPolitica): void {
    Swal.fire({
      title: '¿Eliminar sección?',
      html: `La sección <strong>"${s.titulo}"</strong> será eliminada permanentemente.<br><small style="color:#94A3B8">Esta acción no se puede deshacer.</small>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#F44336', cancelButtonColor: '#607D8B'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.svc.eliminar(s.id!).subscribe({
        next: () => { this.cargar(); Swal.fire({ icon: 'success', title: 'Sección eliminada', timer: 2000, showConfirmButton: false }); },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar.', confirmButtonColor: '#1976D2' })
      });
    });
  }

  buscar() { this.cargar(); }
  aplicar() { this.cargar(); }
  limpiar() { this.filtros = { search: '', activo: '' }; this.cargar(); }

  // ═══════════════════════════════════════════════════════════
  // RICH EDITOR — métodos
  // ═══════════════════════════════════════════════════════════

  onEditorInput(): void {
    if (this._richEditor?.nativeElement) {
      this.form.contenido = this._richEditor.nativeElement.innerHTML;
    }
  }

  execFormat(command: string, value: string = ''): void {
    document.execCommand(command, false, value || undefined);
    this.onEditorInput();
  }

  formatHeading(): void {
    this.focusEditor();

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return;

    const node = selection.anchorNode as HTMLElement;

    const parent = node?.parentElement?.closest('h3');

    document.execCommand(
      'formatBlock',
      false,
      parent ? 'p' : 'h3'
    );

    this.onEditorInput();
  }

  toggleList(ordered: boolean): void {
    this.focusEditor();

    document.execCommand(
      ordered ? 'insertOrderedList' : 'insertUnorderedList',
      false
    );

    this.onEditorInput();
  }

  private focusEditor(): void {
    if (!this._richEditor?.nativeElement) return;

    this._richEditor.nativeElement.focus();
  }

  onEditorKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '\u00a0\u00a0\u00a0\u00a0');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CONVERSIÓN: contenido guardado → HTML para el editor
  // ═══════════════════════════════════════════════════════════

  /** Si ya es HTML lo devuelve tal cual; si es markdown antiguo lo convierte */
  private contentToEditorHtml(content: string): string {
    if (!content.trim()) return '';
    if (/<[a-zA-Z][^>]*>/.test(content)) return content;   
    return this.legacyMarkdownToHtml(content);              
  }

  private legacyMarkdownToHtml(text: string): string {
    const fmt = (s: string) =>
      s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/\*(.+?)\*/g,     '<em>$1</em>');

    const clean = text
      .replace(/\r\n/g, '\n')
      .replace(/\[(ARCO|CARDS|ALERTA|INFO|EXITO|PELIGRO|NUMERADO|SUBSECCION)\][\s\S]*?\[\/\1\]/g, '')
      .trim();

    return clean
      .split(/\n\n+/)
      .map(block => {
        const lines = block.split('\n').filter(l => l.trim());
        if (!lines.length) return '';

        if (lines.every(l => /^[-•*]\s/.test(l.trim()))) {
          const items = lines.map(l =>
            `<li>${fmt(l.replace(/^[-•*]\s*/, '').trim())}</li>`
          ).join('');
          return `<ul>${items}</ul>`;
        }
        if (lines[0].startsWith('## ')) {
          return `<h3>${fmt(lines[0].replace('## ', ''))}</h3>` +
            lines.slice(1).map(l => `<p>${fmt(l)}</p>`).join('');
        }
        return `<p>${lines.map(l => fmt(l)).join('<br>')}</p>`;
      })
      .join('');
  }

  private formVacio(): SeccionPolitica {
    return { seccion_numero: 1, titulo: '', contenido: '', icono: 'document-text-outline', orden: 0 };
  }
}