import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  parseVoiceSearchCommand,
  VOICE_RECOGNITION,
  VoiceRecognition,
  VoiceSearchComponent,
} from './voice-search.component';

describe('VoiceSearchComponent', () => {
  let fixture: ComponentFixture<VoiceSearchComponent>;
  let recognition: VoiceRecognition;

  beforeEach(() => {
    recognition = {
      lang: '',
      continuous: true,
      interimResults: false,
      maxAlternatives: 0,
      onstart: null,
      onend: null,
      onspeechend: null,
      onerror: null,
      onresult: null,
      start: jasmine.createSpy('start'),
      stop: jasmine.createSpy('stop'),
      abort: jasmine.createSpy('abort'),
    };
    TestBed.configureTestingModule({
      imports: [VoiceSearchComponent],
      providers: [{ provide: VOICE_RECOGNITION, useValue: () => recognition }],
    });
    fixture = TestBed.createComponent(VoiceSearchComponent);
    fixture.detectChanges();
  });

  it('configura reconocimiento provisional en español de México', () => {
    fixture.componentInstance.toggle();
    expect(recognition.start).toHaveBeenCalledOnceWith();
    expect(recognition.lang).toBe('es-MX');
    expect(recognition.interimResults).toBeTrue();
    expect(recognition.continuous).toBeFalse();
  });

  it('muestra un resultado provisional sin confirmarlo', () => {
    const preview = jasmine.createSpy('transcribing');
    const recognized = jasmine.createSpy('recognized');
    fixture.componentInstance.transcribing.subscribe(preview);
    fixture.componentInstance.recognized.subscribe(recognized);
    fixture.componentInstance.toggle();

    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'buscar por materia anatomía' } }],
    });

    expect(preview).toHaveBeenCalledWith('buscar por materia anatomía');
    expect(recognized).not.toHaveBeenCalled();
    expect(recognition.stop).not.toHaveBeenCalled();
  });

  it('emite una sola vez al terminar un resultado final', () => {
    const recognized = jasmine.createSpy('recognized');
    const command = jasmine.createSpy('command');
    fixture.componentInstance.recognized.subscribe(recognized);
    fixture.componentInstance.commandRecognized.subscribe(command);
    fixture.componentInstance.toggle();
    const end = recognition.onend;

    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: ' buscar por autor Florence Nightingale. ' } }],
    });
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognized).not.toHaveBeenCalled();

    end?.();
    end?.();

    expect(recognized).toHaveBeenCalledOnceWith('buscar por autor Florence Nightingale');
    expect(command).toHaveBeenCalledOnceWith({
      type: 'autor',
      value: 'Florence Nightingale',
      transcript: 'buscar por autor Florence Nightingale',
    });
  });

  it('detiene tras 1.75 segundos de silencio y reinicia el temporizador', fakeAsync(() => {
    fixture.componentInstance.toggle();
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'buscar' } }],
    });
    tick(1_000);
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'buscar anatomía' } }],
    });
    tick(1_749);
    expect(recognition.stop).not.toHaveBeenCalled();
    tick(1);
    expect(recognition.stop).toHaveBeenCalledOnceWith();
  }));

  it('onspeechend programa la detención normal', fakeAsync(() => {
    fixture.componentInstance.toggle();
    recognition.onspeechend?.();
    tick(1_750);
    expect(recognition.stop).toHaveBeenCalledOnceWith();
    expect(recognition.abort).not.toHaveBeenCalled();
  }));

  it('cancela manualmente con abort y limpia la vista provisional', () => {
    const preview = jasmine.createSpy('transcribing');
    fixture.componentInstance.transcribing.subscribe(preview);
    fixture.componentInstance.toggle();
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'texto anterior' } }],
    });
    fixture.componentInstance.toggle();
    expect(recognition.abort).toHaveBeenCalledOnceWith();
    expect(recognition.stop).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith('');
    expect(fixture.componentInstance.message()).toBe('Dictado cancelado.');
  });

  it('aplica el timeout máximo sin emitir una búsqueda vacía', fakeAsync(() => {
    const recognized = jasmine.createSpy('recognized');
    fixture.componentInstance.recognized.subscribe(recognized);
    fixture.componentInstance.toggle();
    tick(20_000);
    expect(recognition.abort).toHaveBeenCalledOnceWith();
    expect(recognized).not.toHaveBeenCalled();
    expect(fixture.componentInstance.message()).toContain('tiempo');
  }));

  it('limita la transcripción a 200 caracteres e ignora espacios', () => {
    const preview = jasmine.createSpy('transcribing');
    fixture.componentInstance.transcribing.subscribe(preview);
    fixture.componentInstance.toggle();
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'x'.repeat(250) } }],
    });
    expect(preview.calls.mostRecent().args[0].length).toBe(200);

    fixture.componentInstance.toggle();
    preview.calls.reset();
    fixture.componentInstance.toggle();
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: '    ' } }],
    });
    expect(preview).not.toHaveBeenCalled();
  });

  for (const [error, expected] of [
    ['not-allowed', 'denegado'],
    ['network', 'no respondió'],
  ]) {
    it(`informa el error ${error}`, () => {
      fixture.componentInstance.toggle();
      recognition.onerror?.({ error });
      expect(fixture.componentInstance.message()).toContain(expected);
      expect(fixture.componentInstance.listening()).toBeFalse();
    });
  }

  it('no se deshabilita por el estado del backend', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBeFalse();
  });

  it('pide el título si el dictado sólo contiene palabras introductorias', () => {
    const command = jasmine.createSpy('command');
    fixture.componentInstance.commandRecognized.subscribe(command);
    fixture.componentInstance.toggle();
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Buscar libro' } }],
    });
    recognition.onend?.();
    expect(command).not.toHaveBeenCalled();
    expect(fixture.componentInstance.message()).toContain('Di también el título');
  });

  it('distingue falta de audio de un servicio que no devuelve texto', () => {
    fixture.componentInstance.toggle();
    recognition.onend?.();
    expect(fixture.componentInstance.message()).toContain('No llegó audio del micrófono');

    fixture.componentInstance.toggle();
    recognition.onsoundstart?.();
    recognition.onend?.();
    expect(fixture.componentInstance.message()).toContain('no devolvió texto');
  });

  it('variante inline muestra sólo un botón de ícono accesible', () => {
    fixture.componentRef.setInput('variant', 'inline');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.mic');
    expect(button.getAttribute('aria-label')).toBe('Buscar por voz');
    expect(button.textContent?.trim()).toBe('');
    expect(fixture.nativeElement.querySelector('.voice-status')).toBeNull();

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Cancelar dictado');
  });

  it('conserva por defecto los textos de Biblioteca y admite textos configurables', () => {
    expect(fixture.nativeElement.textContent).toContain('La biblioteca recibe el texto de búsqueda.');
    fixture.componentRef.setInput('helpText', 'Materiales recibe el texto de búsqueda.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Materiales recibe el texto de búsqueda.');
  });
});

describe('parseVoiceSearchCommand', () => {
  const cases: Array<[string, string, string]> = [
    ['materia anatomía', 'materia', 'anatomía'],
    ['BUSCAR POR MATERIA Anatomía.', 'materia', 'Anatomía'],
    ['búscame por asignatura anatomia', 'materia', 'anatomia'],
    ['buscar libros de la materia farmacología', 'materia', 'farmacología'],
    ['autor Florence Nightingale', 'autor', 'Florence Nightingale'],
    ['libros escritos por Juan Pérez', 'autor', 'Juan Pérez'],
    ['buscar libros escritos por Juan Pérez', 'autor', 'Juan Pérez'],
    ['título Anatomía Humana', 'titulo', 'Anatomía Humana'],
    ['buscar libro titulado Anatomía Humana', 'titulo', 'Anatomía Humana'],
    ['libro llamado Enfermería Clínica', 'titulo', 'Enfermería Clínica'],
    ['revista titulada Enfermería Hoy', 'titulo', 'Enfermería Hoy'],
    ['buscar revista llamada Salud Integral', 'titulo', 'Salud Integral'],
    ['buscar revista por título Señas Particulares', 'titulo', 'Señas Particulares'],
    ['buscar anatomía', 'general', 'anatomía'],
    ['quiero buscar   farmacología clínica.', 'general', 'farmacología clínica'],
    ['busca libro de Manual de Urgencias', 'general', 'Manual de Urgencias'],
    ['libro Manual de Urgencias', 'general', 'Manual de Urgencias'],
    ['buscar el libro de Cuidados básicos', 'general', 'Cuidados básicos'],
    ['busca revista de Enfermería Hoy', 'general', 'Enfermería Hoy'],
    ['la revista Salud Integral', 'general', 'Salud Integral'],
    ['busca material de Procedimientos de Enfermería', 'general', 'Procedimientos de Enfermería'],
    ['el material Cuidados Básicos', 'general', 'Cuidados Básicos'],
    ['buscar material por título Anatomía', 'titulo', 'Anatomía'],
    ['material llamado Signos Vitales', 'titulo', 'Signos Vitales'],
    ['libros de Juan', 'general', 'Juan'],
    ['Material Guía de Prácticas', 'general', 'Guía de Prácticas'],
    ['Revistas Enfermería Hoy', 'general', 'Enfermería Hoy'],
    ['Quiero buscar por autor Florence Nightingale', 'autor', 'Florence Nightingale'],
  ];

  const titulo = 'Manual de Urgencias';
  const casosManual: Array<[string, string]> = [
    ['Manual de Urgencias', 'general'],
    ['Buscar Manual de Urgencias', 'general'],
    ['Busca Manual de Urgencias', 'general'],
    ['Búscame Manual de Urgencias', 'general'],
    ['Buscame Manual de Urgencias', 'general'],
    ['Quiero buscar Manual de Urgencias', 'general'],
    ['Libro Manual de Urgencias', 'general'],
    ['El libro Manual de Urgencias', 'general'],
    ['Un libro Manual de Urgencias', 'general'],
    ['Buscar libro Manual de Urgencias', 'general'],
    ['Buscar el libro Manual de Urgencias', 'general'],
    ['Busca libro de Manual de Urgencias', 'general'],
    ['Búscame el libro de Manual de Urgencias', 'general'],
    ['Libro llamado Manual de Urgencias', 'titulo'],
    ['Un libro llamado Manual de Urgencias', 'titulo'],
    ['El libro se llama Manual de Urgencias', 'titulo'],
    ['Libro titulado Manual de Urgencias', 'titulo'],
    ['Buscar libro titulado Manual de Urgencias', 'titulo'],
    ['Buscar por título Manual de Urgencias', 'titulo'],
    ['Título Manual de Urgencias', 'titulo'],
    ['Llamado Manual de Urgencias', 'titulo'],
    ['Se llama Manual de Urgencias', 'titulo'],
    ['Llama Manual de Urgencias', 'titulo'],
    ['Muéstrame Manual de Urgencias', 'general'],
    ['Encuentra Manual de Urgencias', 'general'],
    ['Buscar el libro llamado Manual de Urgencias', 'titulo'],
    ['El libro titulado Manual de Urgencias', 'titulo'],
    ['Busca libro con título Manual de Urgencias', 'titulo'],
    ['Buscar un libro que se llama Manual de Urgencias', 'titulo'],
    ['Libros llamados Manual de Urgencias', 'titulo'],
    ['Libros Manual de Urgencias', 'general'],
    ['Buscar, Manual de Urgencias.', 'general'],
    ['BÚSCAME EL LIBRO Manual de Urgencias', 'general'],
    ['Muestrame Manual de Urgencias', 'general'],
  ];

  for (const [input, type] of casosManual) {
    it(`extrae sólo el título de "${input}"`, () => {
      expect(parseVoiceSearchCommand(input)).toEqual({ type: type as never, value: titulo, transcript: input.replace(/\.$/, '') });
    });
  }

  for (const [input, value] of [
    ['Manual de libro', 'Manual de libro'],
    ['Llama roja', 'Llama roja'],
    ['Busca libro de Materiales Dentales', 'Materiales Dentales'],
    ['Libro llamado Corazón sano', 'Corazón sano'],
    ['Enfermería: fundamentos', 'Enfermería: fundamentos'],
  ]) {
    it(`no recorta contenido del título en "${input}"`, () => {
      expect(parseVoiceSearchCommand(input)?.value).toBe(value);
    });
  }

  for (const input of ['Buscar', 'Buscar libro', 'Libro titulado', 'Libro llamado', 'Quiero buscar el libro', 'Buscar materiales']) {
    it(`no busca sólo palabras introductorias: "${input}"`, () => {
      expect(parseVoiceSearchCommand(input)).toBeNull();
    });
  }

  for (const [input, type, value] of cases) {
    it(`interpreta "${input}"`, () => {
      expect(parseVoiceSearchCommand(input)).toEqual(jasmine.objectContaining({ type, value }));
    });
  }

  it('ignora texto vacío', () => {
    expect(parseVoiceSearchCommand('     ')).toBeNull();
  });
});

describe('VoiceSearchComponent sin API del navegador', () => {
  it('muestra la alternativa escrita', () => {
    TestBed.configureTestingModule({
      imports: [VoiceSearchComponent],
      providers: [{ provide: VOICE_RECOGNITION, useValue: null }],
    });
    const fixture = TestBed.createComponent(VoiceSearchComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no está disponible');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
