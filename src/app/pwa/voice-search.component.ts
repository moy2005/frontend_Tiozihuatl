import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, InjectionToken, NgZone, PLATFORM_ID, effect, inject, output, signal, untracked } from '@angular/core';
import { ConnectivityService } from './connectivity.service';

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
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  start(): void;
  abort(): void;
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
  template: `
    <div class="voice-search">
      @if (createRecognition) {
        <button type="button" (click)="toggle()" [disabled]="!connection.available()" [attr.aria-pressed]="listening()" aria-describedby="voice-help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
          {{ listening() ? 'Cancelar dictado' : 'Dictar búsqueda' }}
        </button>
        <p id="voice-help">Al dictar, el navegador puede procesar tu voz en un servicio externo. La biblioteca recibe el texto de búsqueda.</p>
      } @else {
        <p>El dictado no está disponible en este navegador o conexión. Puedes buscar escribiendo.</p>
      }
      <p role="status" aria-live="polite">{{ message() }}</p>
    </div>
  `,
  styles: [`
    .voice-search { text-align:center; max-width:650px; color:inherit; } button { display:inline-flex; align-items:center; gap:.5rem; padding:.55rem .9rem; border:1px solid currentColor; border-radius:8px; color:#12638f; background:#fff; font-weight:700; cursor:pointer; } button[aria-pressed=true] { color:#9b2226; background:#fff1f1; } button:focus-visible { outline:3px solid #25324a; outline-offset:3px; } button:disabled { opacity:.6; } p { margin:.45rem 0 0; font-size:.8rem; line-height:1.4; }
  `],
})
export class VoiceSearchComponent {
  readonly recognized = output<string>();
  readonly createRecognition = inject(VOICE_RECOGNITION);
  readonly connection = inject(ConnectivityService);
  readonly listening = signal(false);
  readonly message = signal('');
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  private recognition?: VoiceRecognition;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => { if (!this.connection.available()) untracked(() => this.cancel('El dictado requiere conexión.')); });
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const hidden = () => { if (document.visibilityState === 'hidden') this.cancel('Dictado detenido.'); };
      document.addEventListener('visibilitychange', hidden);
      this.destroy.onDestroy(() => document.removeEventListener('visibilitychange', hidden));
    }
    this.destroy.onDestroy(() => this.release());
  }

  toggle(): void {
    if (this.listening()) { this.cancel('Dictado cancelado.'); return; }
    if (!this.createRecognition || !this.connection.available()) return;
    this.release();
    const recognition = this.createRecognition();
    this.recognition = recognition;
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    this.listening.set(true);
    this.message.set('Esperando permiso para usar el micrófono…');
    recognition.onstart = () => this.zone.run(() => this.message.set('Escuchando… Di el título o autor del libro.'));
    recognition.onresult = event => this.zone.run(() => {
      if (this.recognition !== recognition || !this.connection.available()) return;
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) parts.push(event.results[i][0].transcript);
      }
      const text = parts.join(' ').trim().slice(0, 200);
      if (!text) return;
      this.recognized.emit(text);
      this.message.set(`Búsqueda: ${text}. Puedes corregirla en el campo de texto.`);
      this.release();
    });
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
      if (this.recognition !== recognition) return;
      this.cancel('No se obtuvo una búsqueda. Vuelve a intentarlo o escribe en el campo.');
    });
    this.zone.runOutsideAngular(() => {
      this.timer = setTimeout(() => this.zone.run(() => this.cancel('Se terminó el tiempo de dictado. Vuelve a intentarlo.')), 20_000);
    });
    try { recognition.start(); }
    catch { this.cancel('No se pudo iniciar el micrófono. Puedes escribir tu búsqueda.'); }
  }

  private cancel(message: string): void {
    this.release();
    this.message.set(message);
  }

  private release(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const recognition = this.recognition;
    this.recognition = undefined;
    if (recognition) {
      recognition.onstart = recognition.onend = recognition.onerror = recognition.onresult = null;
      try { recognition.abort(); } catch {}
    }
    this.listening.set(false);
  }
}
