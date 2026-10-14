import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { CatalogoComponent } from './catalog.component';
import { parseVoiceSearchCommand, VoiceSearchCommand } from '../../../pwa/voice-search.component';

describe('CatalogoComponent - búsqueda por voz', () => {
  let component: CatalogoComponent;

  beforeEach(() => {
    component = new CatalogoComponent({} as never, {} as never);
    component.search = 'búsqueda anterior';
    component.filtroFormato = 'DIGITAL';
    component.filtroSemestre = '2';
    component.ordenAutor = 'ASC';
    component.materias = [{ nombre: 'Anatomía' }, { nombre: 'Farmacología' }];
  });

  const command = (type: VoiceSearchCommand['type'], value: string): VoiceSearchCommand => ({
    type,
    value,
    transcript: value,
  });

  it('muestra provisionalmente sin actualizar la búsqueda confirmada', () => {
    component.mostrarTranscripcionVoz('buscar por materia anatomía');
    expect(component.voicePreview).toBe('buscar por materia anatomía');
    expect(component.search).toBe('búsqueda anterior');
  });

  it('selecciona una materia por coincidencia exacta normalizada y carga una vez', () => {
    const load = spyOn<any>(component, '_ejecutarCarga');
    component.aplicarComandoVoz(command('materia', 'ANATOMIA'));
    expect(component.filtroMateria).toBe('Anatomía');
    expect(component.search).toBe('');
    expect(component.filtroFormato).toBe('DIGITAL');
    expect(component.filtroSemestre).toBe('2');
    expect(component.ordenAutor).toBe('ASC');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('usa búsqueda general si la materia no existe', () => {
    spyOn(component, 'actualizarBusqueda');
    component.aplicarComandoVoz(command('materia', 'Materia inexistente'));
    expect(component.filtroMateria).toBe('');
    expect(component.actualizarBusqueda).toHaveBeenCalledOnceWith('Materia inexistente');
  });

  it('al escribir descarta la vista provisional del dictado', () => {
    spyOn(component, 'actualizarBusqueda');
    component.voicePreview = 'buscar libro';
    component.onSearchInput({ target: { value: 'Manual' } } as unknown as Event);
    expect(component.voicePreview).toBe('');
    expect(component.actualizarBusqueda).toHaveBeenCalledOnceWith('Manual');
  });

  it('una frase dictada produce una sola consulta con el título limpio y los filtros actuales', fakeAsync(() => {
    const obtenerCatalogo = jasmine.createSpy('obtenerCatalogo').and.returnValue(of([]));
    component = new CatalogoComponent({
      obtenerCatalogo,
      obtenerMaterias: () => of([]),
      obtenerSemestres: () => of([]),
    } as never, {} as never);
    component.ngOnInit();
    component.filtroFormato = 'DIGITAL';
    obtenerCatalogo.calls.reset();

    component.aplicarComandoVoz(parseVoiceSearchCommand('Busca libro de Manual de Urgencias')!);
    tick(400);

    expect(obtenerCatalogo).toHaveBeenCalledOnceWith('Manual de Urgencias', '', 'DIGITAL', '', '');
    component.ngOnDestroy();
  }));

  for (const type of ['autor', 'titulo', 'general'] as const) {
    it(`envía ${type} al buscador existente`, () => {
      spyOn(component, 'actualizarBusqueda');
      component.aplicarComandoVoz(command(type, 'Valor limpio'));
      expect(component.voicePreview).toBe('');
      expect(component.actualizarBusqueda).toHaveBeenCalledOnceWith('Valor limpio');
    });
  }
});
