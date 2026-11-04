import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface FragmentoTexto {
  tipo: 'texto' | 'url' | 'correo';
  valor: string;
  href?: string;
}

// URL con protocolo o que empieza por "www." y correos electrónicos.
const PATRON = /\b((?:https?:\/\/|www\.)[^\s<>"']+)|\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
// Signos que suelen cerrar una frase y no forman parte del enlace.
const FINAL_SOBRANTE = /[.,;:!?¡¿)\]}»"'”’]+$/;

/** Divide un texto en fragmentos de texto, enlaces y correos (sin generar HTML). */
export function fragmentarTexto(texto: string | null | undefined): FragmentoTexto[] {
  const fuente = texto ?? '';
  const fragmentos: FragmentoTexto[] = [];
  let ultimo = 0;

  for (const coincidencia of fuente.matchAll(PATRON)) {
    const inicio = coincidencia.index ?? 0;
    let valor = coincidencia[0];
    const sobrante = valor.match(FINAL_SOBRANTE)?.[0] ?? '';
    if (sobrante) valor = valor.slice(0, -sobrante.length);
    if (!valor) continue;

    if (inicio > ultimo) fragmentos.push({ tipo: 'texto', valor: fuente.slice(ultimo, inicio) });

    if (coincidencia[2]) {
      fragmentos.push({ tipo: 'correo', valor, href: `mailto:${valor}` });
    } else {
      const href = /^https?:\/\//i.test(valor) ? valor : `https://${valor}`;
      fragmentos.push({ tipo: 'url', valor, href });
    }
    ultimo = inicio + valor.length;
  }

  if (ultimo < fuente.length) fragmentos.push({ tipo: 'texto', valor: fuente.slice(ultimo) });
  return fragmentos;
}

/**
 * Muestra un texto conservando sus saltos de línea y convierte en enlaces
 * resaltados las direcciones web y los correos que contenga.
 */
@Component({
  selector: 'app-texto-enlazado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (fragmento of fragmentos(); track $index) {@switch (fragmento.tipo) {@case ('texto') {<ng-container>{{ fragmento.valor }}</ng-container>}@case ('correo') {<a class="texto-enlace texto-enlace--correo" [href]="fragmento.href"><i class="ph ph-envelope-simple" aria-hidden="true"></i>{{ fragmento.valor }}</a>}@default {<a class="texto-enlace" [href]="fragmento.href" target="_blank" rel="noopener noreferrer"><i class="ph ph-link-simple" aria-hidden="true"></i>{{ fragmento.valor }}<span class="texto-enlace__sr"> (se abre en otra pestaña)</span></a>}}}`,
  styles: [`
    :host { white-space: pre-wrap; overflow-wrap: anywhere; }

    .texto-enlace {
      display: inline;
      padding: 0.05em 0.35em;
      margin: 0 0.05em;
      color: #1368c4;
      font-weight: 700;
      text-decoration: none;
      background: #e3f2fd;
      border-radius: 6px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .texto-enlace i { margin-right: 0.25em; font-size: 0.95em; vertical-align: -0.1em; }
    .texto-enlace:hover { background: #3fa6e8; color: #ffffff; }
    .texto-enlace:focus-visible { outline: 3px solid #1368c4; outline-offset: 2px; }

    .texto-enlace__sr {
      position: absolute; width: 1px; height: 1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap;
    }
  `],
})
export class TextoEnlazadoComponent {
  readonly texto = input<string | null | undefined>('');
  readonly fragmentos = computed(() => fragmentarTexto(this.texto()));
}
