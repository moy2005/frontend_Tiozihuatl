import { Router, NavigationCancel, NavigationEnd, NavigationError } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

// Duración mínima visible de la bienvenida (desde que empieza a cargar la página),
// para que no aparezca como un destello cuando la carga es muy rápida.
const MIN_VISIBLE_MS = 1100;
// Espera máxima a fuentes e imágenes antes de continuar de todos modos.
const MAX_READY_WAIT_MS = 2500;
// Curva suave: arranque progresivo y llegada larga, sin rebote.
const SOFT = 'cubic-bezier(0.45, 0, 0.2, 1)';
const SOFT_OUT = 'cubic-bezier(0.33, 0, 0.2, 1)';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
// Dos fotogramas para asegurar que la vista inicial ya está pintada.
const nextPaint = () => new Promise<void>(resolve => {
  let done = false;
  const finish = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(() => requestAnimationFrame(finish));
  setTimeout(finish, 100);
});

/**
 * Retira la pantalla de bienvenida de index.html. En Inicio, el logo viaja y
 * crece hasta su lugar en la portada mientras aparecen el título y el navbar;
 * en otras rutas la bienvenida se desvanece y entra el navbar.
 */
export async function playSplashIntro(router: Router): Promise<void> {
  const splash = document.getElementById('app-splash');
  if (!splash) return;

  if (!router.navigated) {
    await firstValueFrom(router.events.pipe(filter(event =>
      event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError)));
  }
  await nextPaint();

  const heroLogo = document.querySelector<HTMLImageElement>('.home-brand-logo');
  await Promise.race([
    Promise.all([document.fonts?.ready, heroLogo?.decode().catch(() => undefined)]),
    wait(MAX_READY_WAIT_MS),
  ]);
  await wait(Math.max(0, MIN_VISIBLE_MS - performance.now()));

  // Si la aplicación tardó tanto que el respaldo CSS ya la ocultó, solo se retira.
  if (getComputedStyle(splash).visibility === 'hidden') {
    splash.remove();
    return;
  }

  splash.style.pointerEvents = 'none';
  const splashLogo = splash.querySelector('img');
  const navbars = Array.from(document.querySelectorAll<HTMLElement>('.navbar-desktop, .navbar-mobile'))
    .filter(nav => getComputedStyle(nav).display !== 'none');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !splashLogo) {
    await splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }).finished;
    splash.remove();
    return;
  }

  const onHome = !!heroLogo && heroLogo.getBoundingClientRect().width > 0 && window.scrollY < 4;

  // El navbar aparece en su sitio con un fundido y un leve descenso: no se
  // desplaza fuera de pantalla, así nunca deja al descubierto lo que hay debajo.
  // Se anima `translate` y no `transform` para no pisar estilos del navbar;
  // `backwards` no deja residuos al terminar.
  for (const nav of navbars) {
    // Al cargar, el navbar puede seguir plegando su franja superior (transición
    // CSS); se completa ya para que aparezca directamente en su estado final.
    nav.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition)
      .forEach(animation => animation.finish());
    nav.animate(
      [{ translate: '0 -10px', opacity: 0 }, { translate: '0 0', opacity: 1 }],
      { duration: 700, delay: onHome ? 260 : 120, easing: SOFT_OUT, fill: 'backwards' },
    );
  }

  if (!onHome || !heroLogo) {
    splashLogo.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }],
      { duration: 520, easing: SOFT_OUT, fill: 'forwards' });
    await splash.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: 520, easing: SOFT_OUT, fill: 'forwards' }).finished;
    splash.remove();
    return;
  }

  // Inicio: el logo de la bienvenida viaja hasta el logo de la portada (misma
  // posición y tamaño final) y ahí se intercambian sin que se note.
  // Se parte del estado visual actual (por si su aparición no ha terminado) y se
  // usa el tamaño de diseño, que no depende de las transformaciones en curso.
  const { transform: current, opacity: currentOpacity } = getComputedStyle(splashLogo);
  splashLogo.getAnimations().forEach(animation => animation.cancel());
  const from = splashLogo.getBoundingClientRect();
  const to = heroLogo.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = to.width / Math.max(splashLogo.offsetWidth, 1);
  heroLogo.style.visibility = 'hidden';

  // La portada debajo es del mismo azul: el fondo se retira sin que se perciba
  // y deja ver el título y el navbar que entran.
  splash.animate([{ backgroundColor: '#3fa6e8' }, { backgroundColor: 'rgba(63, 166, 232, 0)' }],
    { duration: 360, delay: 140, easing: 'linear', fill: 'forwards' });

  const titles = document.querySelectorAll<HTMLElement>('.home-brand-name, .home-brand-name-sub');
  titles.forEach((title, index) => {
    // `filter`/`translate` se suman a la opacidad y transform que escribe el scroll.
    title.animate(
      [{ filter: 'opacity(0)', translate: '0 18px' }, { filter: 'opacity(1)', translate: '0 0' }],
      { duration: 640, delay: 380 + index * 90, easing: SOFT_OUT, fill: 'backwards' },
    );
  });

  await splashLogo.animate(
    [
      { transform: current, opacity: currentOpacity },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 },
    ],
    { duration: 820, easing: SOFT, fill: 'forwards' },
  ).finished;

  heroLogo.style.visibility = '';
  splash.remove();
}
