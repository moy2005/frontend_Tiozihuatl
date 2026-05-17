import {Component, CUSTOM_ELEMENTS_SCHEMA,OnInit,ViewEncapsulation} from '@angular/core';
import { CommonModule }           from '@angular/common';
import { RouterModule }           from '@angular/router';
import { HttpClient }             from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment }            from '../../../../app/api/environments/environment.prod';

interface SeccionPolitica {
  id:             number;
  seccion_numero: number;
  titulo:         string;
  contenido:      string;
  icono:          string;
  orden:          number;
  updated_at?:    string;
}

@Component({
  selector:      'app-privacidad',
  standalone:    true,
  imports:       [CommonModule, RouterModule],
  templateUrl:   './privacidad.html',
  styleUrls:     ['./privacidad.css'],
  schemas:       [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class Privacidad implements OnInit {

  secciones: SeccionPolitica[] = [];
  cargando = true;
  error    = false;

  constructor(
    private http:      HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.http
      .get<SeccionPolitica[]>(`${environment.apiUrl}/privacidad`)
      .subscribe({
        next: (data) => { this.secciones = data; this.cargando = false; },
        error: ()     => { this.error = true;     this.cargando = false; }
      });
  }

  // ── FECHA ÚLTIMA ACTUALIZACIÓN ───────────────────────────────
  get ultimaActualizacion(): string {
    if (!this.secciones.length) return '';
    const fechas = this.secciones
      .map(s => s.updated_at ? new Date(s.updated_at) : null)
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
    if (!fechas.length) return '';
    const max  = new Date(Math.max(...fechas.map(d => d.getTime())));
    const txt  = max.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  // ── CONVERSOR PRINCIPAL ──────────────────────────────────────
  textoAHtml(texto: string): SafeHtml {
  if (!texto?.trim()) return this.sanitizer.bypassSecurityTrustHtml('');

  if (/<[a-zA-Z][^>]*>/.test(texto)) {
    return this.sanitizer.bypassSecurityTrustHtml(texto);
  }

  return this.sanitizer.bypassSecurityTrustHtml(this.procesarTexto(texto));
}

  // ── PROCESADOR CON MARCADORES ────────────────────────────────
  private procesarTexto(texto: string): string {
    const t      = texto.replace(/\r\n/g, '\n').trim();
    const partes: string[] = [];

    // Regex que captura todos los marcadores especiales
    const regex = /\[(ARCO|CARDS|ALERTA|INFO|EXITO|PELIGRO|NUMERADO|SUBSECCION)\]([\s\S]*?)\[\/\1\]/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(t)) !== null) {
      // Texto normal antes del marcador
      if (match.index > lastIndex) {
        const previo = t.slice(lastIndex, match.index).trim();
        if (previo) partes.push(this.procesarBloques(previo));
      }

      const tipo      = match[1];
      const contenido = match[2];

      switch (tipo) {
        case 'ARCO':      partes.push(this.renderArco(contenido));      break;
        case 'CARDS':     partes.push(this.renderCards(contenido));     break;
        case 'ALERTA':    partes.push(this.renderBloque(contenido, 'alerta'));  break;
        case 'INFO':      partes.push(this.renderBloque(contenido, 'info'));    break;
        case 'EXITO':     partes.push(this.renderBloque(contenido, 'exito'));   break;
        case 'PELIGRO':   partes.push(this.renderBloque(contenido, 'peligro')); break;
        case 'NUMERADO':  partes.push(this.renderNumerado(contenido));  break;
        case 'SUBSECCION':partes.push(this.renderSubseccion(contenido)); break;
      }

      lastIndex = regex.lastIndex;
    }

    // Texto restante
    if (lastIndex < t.length) {
      const resto = t.slice(lastIndex).trim();
      if (resto) partes.push(this.procesarBloques(resto));
    }

    return partes.join('');
  }

  // ──  (párrafos y listas) ──────────────────────
  private procesarBloques(texto: string): string {
    return texto
      .split(/\n\n+/)
      .map(bloque => {
        const lineas = bloque.split('\n').filter(l => l.trim());
        if (!lineas.length) return '';

        // Lista con - • *
        if (lineas.every(l => /^[-•*]\s/.test(l.trim()))) {
          const items = lineas
            .map(l => `<li class="politica-lista-item">${this.formatearInline(l.replace(/^[-•*]\s*/, '').trim())}</li>`)
            .join('');
          return `<ul class="politica-lista">${items}</ul>`;
        }

        // Sub-sección con ##
        if (lineas[0].startsWith('## ')) {
          const titulo = this.formatearInline(lineas[0].replace('## ', ''));
          const resto  = lineas.slice(1)
            .map(l => `<p class="politica-parrafo">${this.formatearInline(l)}</p>`).join('');
          return `<h3 class="subseccion-h3">${titulo}</h3>${resto}`;
        }

        return `<p class="politica-parrafo">${lineas.map(l => this.formatearInline(l)).join('<br>')}</p>`;
      })
      .join('');
  }

  // ── FORMATO INLINE (negrita, cursiva) ────────────────────────
  private formatearInline(texto: string): string {
    return texto
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>');
  }

  // ── CARDS ARCO (2 columnas con gradiente) ────────────────────
  private renderArco(contenido: string): string {
    const cards = contenido.trim().split('\n')
      .filter(l => l.trim() && l.includes('|'))
      .map(l => {
        const partes  = l.trim().split('|');
        const icono   = partes[0]?.trim() || 'document-outline';
        const titulo  = partes[1]?.trim() || '';
        const desc    = partes[2]?.trim() || '';
        return `
          <div class="arco-card">
            <div class="arco-card-icon">
              <ion-icon name="${icono}"></ion-icon>
            </div>
            <div class="arco-card-titulo">${titulo}</div>
            <div class="arco-card-desc">${desc}</div>
          </div>`;
      }).join('');
    return `<div class="arco-grid">${cards}</div>`;
  }

  // ── CARDS GENÉRICAS (iconos con borde) ───────────────────────
  private renderCards(contenido: string): string {
    const cards = contenido.trim().split('\n')
      .filter(l => l.trim() && l.includes('|'))
      .map(l => {
        const partes  = l.trim().split('|');
        const icono   = partes[0]?.trim() || 'document-outline';
        const titulo  = partes[1]?.trim() || '';
        const desc    = partes[2]?.trim() || '';
        return `
          <div class="generic-card">
            <div class="generic-card-icon">
              <ion-icon name="${icono}"></ion-icon>
            </div>
            <div>
              <div class="generic-card-titulo">${titulo}</div>
              <div class="generic-card-desc">${desc}</div>
            </div>
          </div>`;
      }).join('');
    return `<div class="cards-grid">${cards}</div>`;
  }

  // ── BLOQUES ESPECIALES (alerta, info, exito, peligro) ────────
  private renderBloque(contenido: string, tipo: string): string {
    const lineas = contenido.trim().split('\n').filter(l => l.trim());
    const titulo = lineas[0] || '';
    const resto  = lineas.slice(1);

    const iconoMap: Record<string, string> = {
      alerta:  'warning-outline',
      info:    'information-circle-outline',
      exito:   'checkmark-circle-outline',
      peligro: 'close-circle-outline'
    };

    const cuerpoHtml = resto.map(l => {
      if (/^[-•*]\s/.test(l.trim())) {
        return `<li class="bloque-lista-item">${this.formatearInline(l.replace(/^[-•*]\s*/, '').trim())}</li>`;
      }
      return `<p class="bloque-parrafo">${this.formatearInline(l)}</p>`;
    });

    const hayLista = resto.some(l => /^[-•*]\s/.test(l.trim()));
    const cuerpo   = hayLista
      ? `<ul class="bloque-lista">${cuerpoHtml.join('')}</ul>`
      : cuerpoHtml.join('');

    return `
      <div class="bloque-especial bloque-${tipo}">
        <div class="bloque-header">
          <ion-icon name="${iconoMap[tipo] || 'alert-outline'}"></ion-icon>
          <strong>${this.formatearInline(titulo)}</strong>
        </div>
        <div class="bloque-cuerpo">${cuerpo}</div>
      </div>`;
  }

  // ── LISTA NUMERADA ───────────────────────────────────────────
  private renderNumerado(contenido: string): string {
    const items = contenido.trim().split('\n')
      .filter(l => l.trim())
      .map((l, i) => `
        <li class="numerado-item">
          <span class="numerado-num">${i + 1}</span>
          <span>${this.formatearInline(l.replace(/^\d+[\.\)]\s*/, '').trim())}</span>
        </li>`)
      .join('');
    return `<ol class="numerado-lista">${items}</ol>`;
  }

  // ── SUB-SECCIÓN CON ICONO ────────────────────────────────────
  private renderSubseccion(contenido: string): string {
    const lineas = contenido.trim().split('\n').filter(l => l.trim());
    const primera = lineas[0] || '';
    const partes  = primera.includes('|') ? primera.split('|') : ['document-outline', primera];
    const icono   = partes.length > 1 ? partes[0].trim() : 'document-outline';
    const titulo  = partes.length > 1 ? partes[1].trim() : partes[0].trim();
    const resto   = lineas.slice(1);

    const cuerpoHtml = resto.map(l => {
      if (/^[-•*]\s/.test(l.trim())) {
        return `<li class="politica-lista-item">${this.formatearInline(l.replace(/^[-•*]\s*/, '').trim())}</li>`;
      }
      return `<p class="politica-parrafo" style="margin:.25rem 0;">${this.formatearInline(l)}</p>`;
    });

    const hayLista = resto.some(l => /^[-•*]\s/.test(l.trim()));
    const cuerpo   = hayLista
      ? `<ul class="politica-lista" style="margin-top:.75rem;">${cuerpoHtml.join('')}</ul>`
      : cuerpoHtml.join('');

    return `
      <div class="subseccion-card">
        <div class="subseccion-card-header">
          <ion-icon name="${icono}"></ion-icon>
          <strong>${this.formatearInline(titulo)}</strong>
        </div>
        <div class="subseccion-card-body">${cuerpo}</div>
      </div>`;
  }
}