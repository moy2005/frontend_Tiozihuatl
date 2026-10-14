import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, InjectionToken, Input, NgZone, PLATFORM_ID, inject, output, signal } from '@angular/core';

export interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface VoiceRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface VoiceSearchCommand {
  type: 'general' | 'materia' | 'autor' | 'titulo';
  value: string;
  transcript: string;
}

const MAX_TRANSCRIPT_LENGTH = 200;
const SILENCE_DELAY_MS = 1_750;
const MAX_LISTENING_MS = 20_000;

export function cleanVoiceTranscript(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().replace(/[.,;:!?¿¡]+$/gu, '').trim().slice(0, MAX_TRANSCRIPT_LENGTH).trim();
}

export function normalizeVoiceText(value: string): string {
  return cleanVoiceTranscript(value).normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('es-MX');
}

/*
 * Los patrones se evalúan sobre una copia sin acentos con la misma longitud que
 * la transcripción, así el valor se recorta del texto original conservando acentos.
 * Todos terminan en (.+)$ y se aplican en orden: materia, autor, título,
 * frase natural (libro/revista/material) y búsqueda general.
 */
const VERB = String.raw`(?:(?:quiero|quisiera)\s+(?:buscar|encontrar|ver)|buscar|busca|buscame|busco|muestrame|muestra|encuentra|encuentrame)`;
const ARTICLE = String.raw`(?:(?:el|la|los|las|un|una)\s+)`;
const ITEM = String.raw`(?:libros?|revistas?|material(?:es)?)`;
const OPTIONAL_VERB = String.raw`(?:${VERB}[\s,.;:]+)?`;
const OPTIONAL_ITEM = String.raw`(?:${ARTICLE}?${ITEM}\s+)?`;
const voicePattern = (source: string) => new RegExp(`^${source}(.+)$`, 'iu');

const COMMAND_RULES: Array<{ type: VoiceSearchCommand['type']; patterns: RegExp[] }> = [
  {
    type: 'materia',
    patterns: [
      voicePattern(String.raw`${OPTIONAL_VERB}(?:${ARTICLE}?libros?\s+)?(?:por\s+|de\s+la\s+)?(?:materia|asignatura)\s+`),
    ],
  },
  {
    type: 'autor',
    patterns: [
      voicePattern(String.raw`${OPTIONAL_VERB}${OPTIONAL_ITEM}(?:por\s+(?:el\s+|la\s+)?|del\s+|de\s+la\s+)?autora?\s+`),
      voicePattern(String.raw`${OPTIONAL_VERB}${OPTIONAL_ITEM}escrit[oa]s?\s+por\s+`),
    ],
  },
  {
    type: 'titulo',
    patterns: [
      voicePattern(String.raw`${OPTIONAL_VERB}${OPTIONAL_ITEM}(?:(?:por|con|de)\s+(?:el\s+)?)?titulo\s+`),
      voicePattern(String.raw`${OPTIONAL_VERB}${OPTIONAL_ITEM}(?:que\s+)?(?:se\s+llama|llamad[oa]s?|titulad[oa]s?)\s+`),
      // "Llama" sola es ambigua: sólo al inicio y seguida de al menos dos palabras.
      voicePattern(String.raw`llama\s+(?=\S+\s+\S)`),
    ],
  },
  {
    type: 'general',
    patterns: [
      voicePattern(String.raw`${OPTIONAL_VERB}${ARTICLE}?${ITEM}(?:\s+de)?\s+`),
      voicePattern(String.raw`${VERB}[\s,.;:]+${ARTICLE}?`),
    ],
  },
];

// Palabras que por sí solas no son una búsqueda (p. ej. dictado cortado tras "Buscar libro").
const KEYWORDS_ONLY = new Set(
  ('buscar busca buscame busco quiero quisiera encontrar ver muestrame muestra encuentra encuentrame '
    + 'el la los las un una libro libros revista revistas material materiales de del por con que se '
    + 'llama llamado llamada llamados llamadas titulado titulada titulados tituladas titulo '
    + 'materia asignatura autor autora escrito escrita escritos escritas').split(' '),
);

function foldAccents(value: string): string {
  return value.replace(/[^\u0000-\u007f]/gu, char => {
    const base = char.normalize('NFD')[0];
    return base.length === char.length ? base : char;
  });
}

export function parseVoiceSearchCommand(rawTranscript: string): VoiceSearchCommand | null {
  const transcript = cleanVoiceTranscript(rawTranscript);
  if (!transcript) return null;
  const folded = foldAccents(transcript);

  let type: VoiceSearchCommand['type'] = 'general';
  let value = transcript;
  match: for (const rule of COMMAND_RULES) {
    for (const pattern of rule.patterns) {
      const captured = folded.match(pattern)?.[1];
      const candidate = captured ? cleanVoiceTranscript(transcript.slice(transcript.length - captured.length)) : '';
      if (candidate) {
        type = rule.type;
        value = candidate;
        break match;
      }
    }
  }

  const onlyKeywords = normalizeVoiceText(value).split(' ').every(word => KEYWORDS_ONLY.has(word));
  return onlyKeywords ? null : { type, value, transcript };
}

export const VOICE_RECOGNITION = new InjectionToken<(() => VoiceRecognition) | null>('VOICE_RECOGNITION', {
  providedIn: 'root',
  factory: () => {
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || !window.isSecureContext) return null;
    const browser = window as unknown as { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    return Recognition ? () => new Recognition() : null;
  },
});

@Component({
  selector: 'app-voice-search',
  standalone: true,
  host: { '[class.inline]': "variant === 'inline'" },
  template: `
    @if (variant === 'inline') {
      @if (createRecognition) {
        <button type="button" class="mic" (click)="toggle()" [attr.aria-pressed]="listening()"
          [attr.aria-label]="listening() ? 'Cancelar dictado' : 'Buscar por voz'"
          [attr.title]="listening() ? 'Cancelar dictado' : 'Buscar por voz'" aria-describedby="voice-help-inline">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
        </button>
        <span id="voice-help-inline" class="sr-only">{{ helpText }}</span>
      }
    } @else {
    <div class="voice-search">
      @if (createRecognition) {
        <button type="button" (click)="toggle()" [attr.aria-pressed]="listening()" aria-describedby="voice-help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
          {{ listening() ? 'Cancelar dictado' : 'Dictar búsqueda' }}
        </button>
        <p id="voice-help">{{ helpText }}</p>
      } @else {
        <p>El dictado no está disponible en este navegador o contexto. Puedes buscar escribiendo.</p>
      }
      <p class="voice-status" role="status" aria-live="polite">{{ message() }}</p>
    </div>
    }
  `,
  styles: [`
    :host { display:block; width:100%; min-width:0; }
    .voice-search { width:100%; max-width:650px; margin-inline:auto; padding-inline:.25rem; text-align:center; color:inherit; box-sizing:border-box; overflow-wrap:anywhere; }
    button { display:inline-flex; max-width:100%; align-items:center; justify-content:center; gap:.5rem; padding:.55rem .9rem; border:1px solid currentColor; border-radius:8px; color:#12638f; background:#fff; font:inherit; font-weight:700; cursor:pointer; }
    button[aria-pressed=true] { color:#9b2226; background:#fff1f1; }
    button:focus-visible { outline:3px solid #25324a; outline-offset:3px; }
    p { margin:.45rem 0 0; font-size:.8rem; line-height:1.4; }
    .voice-status { min-height:1.4em; }
    :host(.inline) { display:inline-flex; width:auto; }
    .mic { position:relative; width:40px; height:40px; padding:0; gap:0; border:none; border-radius:8px; color:#2D8BE8; background:transparent; transition:background-color .2s, color .2s; }
    .mic:hover { color:#1a6fc4; background:#eaf5fd; }
    .mic[aria-pressed=true] { color:#fff; background:#e5484d; }
    .mic[aria-pressed=true]::after { content:''; position:absolute; inset:0; border-radius:inherit; animation:mic-pulse 1.4s ease-out infinite; pointer-events:none; }
    .mic:focus-visible { outline:2px solid #2D8BE8; outline-offset:2px; }
    @keyframes mic-pulse { from { box-shadow:0 0 0 0 rgba(229,72,77,.5); } to { box-shadow:0 0 0 10px rgba(229,72,77,0); } }
    @media (prefers-reduced-motion: reduce) { .mic[aria-pressed=true]::after { animation:none; } }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
  `],
})
export class VoiceSearchComponent {
  @Input() helpText = 'Al dictar, el navegador puede procesar tu voz en un servicio externo. La biblioteca recibe el texto de búsqueda.';
  @Input() listeningMessage = 'Escuchando… Di el título o autor del libro.';
  /** 'inline' muestra sólo el botón de ícono; el contenedor debe mostrar `message()` en su propia región de estado. */
  @Input() variant: 'block' | 'inline' = 'block';
  readonly recognized = output<string>();
  readonly transcribing = output<string>();
  readonly commandRecognized = output<VoiceSearchCommand>();
  readonly createRecognition = inject(VOICE_RECOGNITION);
  readonly listening = signal(false);
  readonly message = signal('');
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  private recognition?: VoiceRecognition;
  private silenceTimer?: ReturnType<typeof setTimeout>;
  private maxTimer?: ReturnType<typeof setTimeout>;
  private finalTranscript = '';
  private interimTranscript = '';
  private finalized = false;
  private stopping = false;
  private heardSound = false;

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const hidden = () => { if (document.visibilityState === 'hidden') this.cancel('Dictado detenido.'); };
      document.addEventListener('visibilitychange', hidden);
      this.destroy.onDestroy(() => document.removeEventListener('visibilitychange', hidden));
    }
    this.destroy.onDestroy(() => this.release(true));
  }

  toggle(): void {
    if (this.listening()) { this.cancel('Dictado cancelado.'); return; }
    if (!this.createRecognition) return;
    this.release(true);
    this.resetSession();
    const recognition = this.createRecognition();
    this.recognition = recognition;
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    this.listening.set(true);
    this.message.set('Esperando permiso para usar el micrófono…');
    recognition.onstart = () => this.zone.run(() => this.message.set(this.listeningMessage));
    recognition.onresult = event => this.zone.run(() => this.handleResult(recognition, event));
    recognition.onsoundstart = () => { this.heardSound = true; };
    recognition.onspeechend = () => this.zone.run(() => this.scheduleSilenceStop(recognition));
    recognition.onerror = event => this.zone.run(() => {
      const messages: Record<string, string> = {
        'not-allowed': 'Permiso de micrófono denegado. Puedes habilitarlo en el navegador o escribir tu búsqueda.',
        'service-not-allowed': 'El navegador no permite el reconocimiento de voz. Puedes escribir tu búsqueda.',
        'audio-capture': 'No se encontró un micrófono disponible.',
        'no-speech': 'No se detectó voz. Vuelve a intentarlo o escribe tu búsqueda.',
        'network': 'El servicio de dictado no respondió. Puedes escribir tu búsqueda.',
        'language-not-supported': 'El navegador no admite dictado en español de México.',
        'aborted': 'Dictado cancelado.',
      };
      this.cancel(messages[event.error] || 'No se pudo reconocer la voz. Puedes escribir tu búsqueda.');
    });
    recognition.onend = () => this.zone.run(() => {
      if (this.recognition !== recognition || this.finalized) return;
      this.finalizeRecognition();
    });
    this.zone.runOutsideAngular(() => {
      this.maxTimer = setTimeout(() => this.zone.run(() => {
        if (this.hasTranscript()) this.requestStop(recognition);
        else this.cancel('Se terminó el tiempo de dictado. Vuelve a intentarlo.');
      }), MAX_LISTENING_MS);
    });
    try { recognition.start(); }
    catch { this.cancel('No se pudo iniciar el micrófono. Puedes escribir tu búsqueda.'); }
  }

  private handleResult(recognition: VoiceRecognition, event: RecognitionResultEvent): void {
    if (this.recognition !== recognition || this.finalized) return;
    const interimParts: string[] = [];
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i]?.[0]?.transcript || '';
      if (event.results[i].isFinal) {
        this.finalTranscript = cleanVoiceTranscript(`${this.finalTranscript} ${transcript}`);
      }
      else interimParts.push(transcript);
    }
    this.interimTranscript = cleanVoiceTranscript(interimParts.join(' '));
    const visible = cleanVoiceTranscript([this.finalTranscript, this.interimTranscript].filter(Boolean).join(' '));
    if (visible) {
      this.transcribing.emit(visible);
      this.message.set('Escuchando…');
      this.scheduleSilenceStop(recognition);
    }
    if (this.finalTranscript) this.requestStop(recognition);
  }

  private scheduleSilenceStop(recognition: VoiceRecognition): void {
    if (this.recognition !== recognition || this.finalized || this.stopping) return;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.zone.runOutsideAngular(() => {
      this.silenceTimer = setTimeout(() => this.zone.run(() => this.requestStop(recognition)), SILENCE_DELAY_MS);
    });
  }

  private requestStop(recognition: VoiceRecognition): void {
    if (this.recognition !== recognition || this.finalized || this.stopping) return;
    this.stopping = true;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = undefined;
    try { recognition.stop(); }
    catch { this.finalizeRecognition(); }
  }

  private finalizeRecognition(): void {
    if (this.finalized) return;
    this.finalized = true;
    const transcript = cleanVoiceTranscript(this.finalTranscript || this.interimTranscript);
    const command = parseVoiceSearchCommand(transcript);
    this.release(false);
    this.transcribing.emit('');
    if (!command) {
      // Sin texto: distingue si faltó audio del micrófono o si el servicio del navegador no respondió texto.
      this.message.set(transcript
        ? `Escuché «${transcript}». Di también el título, autor o materia.`
        : this.heardSound
          ? 'El navegador captó audio, pero su servicio de dictado no devolvió texto. Vuelve a intentarlo; si se repite, recarga la página o escribe tu búsqueda.'
          : 'No llegó audio del micrófono. Revisa que esté seleccionado el micrófono correcto o escribe tu búsqueda.');
      return;
    }
    this.commandRecognized.emit(command);
    this.recognized.emit(command.transcript);
    this.message.set('Dictado detenido.');
  }

  private cancel(message: string): void {
    this.finalized = true;
    this.release(true);
    this.transcribing.emit('');
    this.message.set(message);
  }

  private resetSession(): void {
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.finalized = false;
    this.stopping = false;
    this.heardSound = false;
  }

  private hasTranscript(): boolean {
    return !!cleanVoiceTranscript(this.finalTranscript || this.interimTranscript);
  }

  private release(abort: boolean): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.silenceTimer = undefined;
    this.maxTimer = undefined;
    const recognition = this.recognition;
    this.recognition = undefined;
    if (recognition) {
      recognition.onstart = recognition.onend = recognition.onspeechend = recognition.onsoundstart = recognition.onerror = recognition.onresult = null;
      if (abort) { try { recognition.abort(); } catch {} }
    }
    this.listening.set(false);
    this.stopping = false;
  }
}
