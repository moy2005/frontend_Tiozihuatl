import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ConnectivityService } from './connectivity.service';
import { VOICE_RECOGNITION, VoiceRecognition, VoiceSearchComponent } from './voice-search.component';

describe('Dictado para buscar libros', () => {
  let fixture: ComponentFixture<VoiceSearchComponent>;
  let recognition: VoiceRecognition;
  beforeEach(() => {
    recognition = { lang: '', continuous: true, interimResults: true, maxAlternatives: 0, onstart: null, onend: null, onerror: null, onresult: null, start: jasmine.createSpy('start'), abort: jasmine.createSpy('abort') };
    TestBed.configureTestingModule({ imports: [VoiceSearchComponent], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: VOICE_RECOGNITION, useValue: () => recognition }] });
    fixture = TestBed.createComponent(VoiceSearchComponent);
    TestBed.inject(ConnectivityService).state.set('online');
    fixture.detectChanges();
  });

  it('solo inicia al solicitarlo y entrega texto final en español de México', () => {
    const result = jasmine.createSpy('recognized');
    fixture.componentInstance.recognized.subscribe(result);
    expect(recognition.start).not.toHaveBeenCalled();
    fixture.componentInstance.toggle();
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.lang).toBe('es-MX');
    recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: ' Anatomía humana ' } }] });
    expect(result).toHaveBeenCalledOnceWith('Anatomía humana');
    expect(fixture.componentInstance.listening()).toBeFalse();
    expect(recognition.abort).toHaveBeenCalled();
  });

  it('informa permisos denegados y detiene la captura', () => {
    fixture.componentInstance.toggle();
    recognition.onerror?.({ error: 'not-allowed' });
    expect(fixture.componentInstance.message()).toContain('denegado');
    expect(fixture.componentInstance.listening()).toBeFalse();
  });

  it('cancela al perder conexión y al salir de la pantalla', () => {
    fixture.componentInstance.toggle();
    TestBed.inject(ConnectivityService).state.set('offline');
    fixture.detectChanges();
    expect(recognition.abort).toHaveBeenCalled();
    expect(fixture.componentInstance.listening()).toBeFalse();
    TestBed.inject(ConnectivityService).state.set('online');
    fixture.detectChanges();
    fixture.componentInstance.toggle();
    fixture.destroy();
    expect(recognition.onresult).toBeNull();
    expect(recognition.onend).toBeNull();
  });
});
