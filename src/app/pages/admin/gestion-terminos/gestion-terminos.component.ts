import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
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
    setTimeout(() => { this.setEditorContent(this.contentToEditorHtml(s.contenido || '')); }, 50);
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.form = this.formVacio();
    this.modoEdicion = false;
    this.editandoId = null;
  }

  // ── GUARDAR ───────────────────────────────
  guardar(): void {
    this.syncEditorContent();

    if (!this.form.titulo?.trim() || !this.getPlainText(this.form.contenido).trim()) {
      Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'El título y el contenido son obligatorios.', confirmButtonColor: '#3FA6E8' });
      return;
    }

    this.cargando = true;
    const fueEdicion = this.modoEdicion;
    const payload = { ...this.form, contenido: this.editorHtmlToStorage(this.form.contenido) };

    const accion = fueEdicion
      ? this.svc.actualizar(this.editandoId!, payload)
      : this.svc.crear(payload);

    accion.subscribe({
      next: () => {
        this.cargando = false;
        this.cerrarModal();
        this.cargar();
        Swal.fire({
          icon: 'success',
          title: fueEdicion ? '¡Actualizado!' : '¡Creado!',
          text: `La sección fue ${fueEdicion ? 'actualizada' : 'registrada'} correctamente.`,
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
      const cleanHtml = this.normalizeEditorHtml(html);
      this.editor.innerHTML = cleanHtml;
      this.form.contenido = cleanHtml;
    }
  }

  onEditorInput(): void {
    this.syncEditorContent();
  }

  private syncEditorContent(): void {
    if (this.editor) {
      this.form.contenido = this.normalizeEditorHtml(this.editor.innerHTML);
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
    this.prepareEditorCommand();
    document.execCommand(command, false, value);
    this.onEditorInput();
  }

  formatHeading(): void {
    this.prepareEditorCommand();

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
    this.onEditorInput();
  }

  toggleList(ordered: boolean): void {
    this.prepareEditorCommand();

    const cmd = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(cmd, false);
    this.onEditorInput();
  }

  private prepareEditorCommand(): void {
    const editor = this.editor;
    if (!editor) return;
    document.execCommand('styleWithCSS', false, 'false');

    const selection = window.getSelection();
    const activeNode = selection?.anchorNode;
    const selectionInsideEditor = !!activeNode && editor.contains(
      activeNode.nodeType === Node.ELEMENT_NODE ? activeNode : activeNode.parentNode
    );

    editor.focus();

    if (selectionInsideEditor) return;

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  private formVacio(): SeccionTermino {
    return { numero: 1, titulo: '', subtitulo: '', contenido: '', orden: 0 };
  }

  private contentToEditorHtml(content: string): string {
    if (!content.trim()) return '';
    if (/<[a-zA-Z][^>]*>/.test(content)) return content;
    return content
      .replace(/\r\n/g, '\n')
      .trim()
      .split(/\n\n+/)
      .map(block => {
        const lines = block.split('\n').filter(line => line.trim());
        if (!lines.length) return '';

        if (lines.every(line => /^[-•*]\s/.test(line.trim()))) {
          return `<ul>${lines.map(line => `<li>${this.formatInline(line.replace(/^[-•*]\s*/, '').trim())}</li>`).join('')}</ul>`;
        }

        if (lines.every(line => /^\d+\.\s/.test(line.trim()))) {
          return `<ol>${lines.map(line => `<li>${this.formatInline(line.replace(/^\d+\.\s*/, '').trim())}</li>`).join('')}</ol>`;
        }

        if (lines[0].startsWith('## ')) {
          return `<h3>${this.formatInline(lines[0].replace('## ', '').trim())}</h3>` +
            lines.slice(1).map(line => `<p>${this.formatInline(line)}</p>`).join('');
        }

        return `<p>${lines.map(line => this.formatInline(line)).join('<br>')}</p>`;
      })
      .join('');
  }

  private formatInline(text: string): string {
    return text
      .replace(/\[u\]([\s\S]+?)\[\/u\]/g, '<u>$1</u>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  private editorHtmlToStorage(html: string): string {
    const normalized = this.normalizeEditorHtml(html);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${normalized}</div>`, 'text/html');
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return '';

    const blocks = Array.from(root.childNodes)
      .map(node => this.blockNodeToStorage(node))
      .filter(text => text.trim());

    return blocks.join('\n\n').trim();
  }

  private blockNodeToStorage(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').trim();
    if (!(node instanceof HTMLElement)) return '';

    if (node.tagName === 'H3') return `## ${this.inlineNodesToStorage(node.childNodes)}`.trim();

    if (node.tagName === 'UL') {
      return Array.from(node.children)
        .filter(child => child.tagName === 'LI')
        .map(child => `- ${this.inlineNodesToStorage(child.childNodes)}`.trim())
        .join('\n');
    }

    if (node.tagName === 'OL') {
      return Array.from(node.children)
        .filter(child => child.tagName === 'LI')
        .map((child, index) => `${index + 1}. ${this.inlineNodesToStorage(child.childNodes)}`.trim())
        .join('\n');
    }

    if (node.tagName === 'BR') return '';
    return this.inlineNodesToStorage(node.childNodes).trim();
  }

  private inlineNodesToStorage(nodes: NodeListOf<ChildNode> | NodeList): string {
    return Array.from(nodes).map(node => this.inlineNodeToStorage(node)).join('');
  }

  private inlineNodeToStorage(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (!(node instanceof HTMLElement)) return '';

    const inner = this.inlineNodesToStorage(node.childNodes);
    if (node.tagName === 'STRONG' || node.tagName === 'B') return `**${inner}**`;
    if (node.tagName === 'EM' || node.tagName === 'I') return `*${inner}*`;
    if (node.tagName === 'U') return `[u]${inner}[/u]`;
    if (node.tagName === 'BR') return '\n';
    if (node.tagName === 'UL' || node.tagName === 'OL') return `\n${this.blockNodeToStorage(node)}\n`;
    return inner;
  }

  private getPlainText(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || '';
  }

  private normalizeEditorHtml(html: string): string {
    if (!html || html === '<br>') return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return '';

    this.convertInlineStyles(root);
    root.querySelectorAll('b').forEach(el => this.renameElement(el, 'strong'));
    root.querySelectorAll('i').forEach(el => this.renameElement(el, 'em'));
    root.querySelectorAll('span, font').forEach(el => el.replaceWith(...Array.from(el.childNodes)));
    root.querySelectorAll('s, strike').forEach(el => el.replaceWith(...Array.from(el.childNodes)));

    const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'H3', 'UL', 'OL', 'LI', 'DIV']);
    root.querySelectorAll('*').forEach(el => {
      if (!allowedTags.has(el.tagName)) {
        el.replaceWith(...Array.from(el.childNodes));
        return;
      }
      Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));
    });

    return root.innerHTML
      .replace(/<div><br><\/div>/g, '')
      .replace(/<p><br><\/p>/g, '')
      .trim();
  }

  private renameElement(el: Element, tagName: string): void {
    const replacement = document.createElement(tagName);
    replacement.innerHTML = el.innerHTML;
    el.replaceWith(replacement);
  }

  private convertInlineStyles(root: HTMLElement): void {
    root.querySelectorAll('[style]').forEach(el => {
      const style = (el.getAttribute('style') || '').toLowerCase();
      const wrappers: string[] = [];

      if (/font-weight\s*:\s*(bold|[6-9]00)/.test(style)) wrappers.push('strong');
      if (/font-style\s*:\s*italic/.test(style)) wrappers.push('em');
      if (/text-decoration[^;]*underline/.test(style)) wrappers.push('u');
      if (!wrappers.length) return;

      const wrappedHtml = wrappers.reduceRight((html, tag) => `<${tag}>${html}</${tag}>`, el.innerHTML);

      if (['SPAN', 'FONT'].includes(el.tagName)) {
        this.replaceElementWithHtml(el, wrappedHtml);
      } else {
        el.innerHTML = wrappedHtml;
      }
    });
  }

  private replaceElementWithHtml(el: Element, html: string): void {
    const template = document.createElement('template');
    template.innerHTML = html;
    el.replaceWith(...Array.from(template.content.childNodes));
  }
}
