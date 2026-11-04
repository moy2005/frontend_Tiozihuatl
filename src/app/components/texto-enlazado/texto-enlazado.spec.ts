import { fragmentarTexto } from './texto-enlazado';

describe('fragmentarTexto', () => {
  it('detecta enlaces y correos sin incluir la puntuación final', () => {
    const fragmentos = fragmentarTexto('Inscríbete en https://iest.edu.mx/registro. Dudas: eventos@iest.edu.mx, o www.iest.edu.mx');
    expect(fragmentos.filter(f => f.tipo !== 'texto')).toEqual([
      { tipo: 'url', valor: 'https://iest.edu.mx/registro', href: 'https://iest.edu.mx/registro' },
      { tipo: 'correo', valor: 'eventos@iest.edu.mx', href: 'mailto:eventos@iest.edu.mx' },
      { tipo: 'url', valor: 'www.iest.edu.mx', href: 'https://www.iest.edu.mx' },
    ]);
    expect(fragmentos.map(f => f.valor).join('')).toBe('Inscríbete en https://iest.edu.mx/registro. Dudas: eventos@iest.edu.mx, o www.iest.edu.mx');
  });

  it('no convierte en enlace esquemas no web ni texto sin direcciones', () => {
    expect(fragmentarTexto('javascript:alert(1) y texto normal')).toEqual([
      { tipo: 'texto', valor: 'javascript:alert(1) y texto normal' },
    ]);
    expect(fragmentarTexto(null)).toEqual([]);
  });
});
