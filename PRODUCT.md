# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Público general del Instituto de Estudios Superiores Tiozihuatl. El público principal son estudiantes (aspirantes y alumnos), pero la página es pública y también la consultan docentes, personal y visitantes.

## Product Purpose
Sitio y sistema institucional de una escuela de enfermería: informa a la comunidad (noticias, eventos, calendario) y da acceso a servicios académicos (biblioteca/catálogo, revistas, materiales, compras y préstamos). En Inicio, el éxito es que quien llega entienda qué es el instituto, vea lo más reciente y encuentre rápido la sección que necesita.

## Positioning
Institución de educación superior dedicada a formar profesionales de enfermería, con identidad propia: "Vocación, Fe y Esperanza".

## Operating Context
Angular 20 (SSR + PWA con modo sin conexión), Tailwind 3, API propia en `/api` (noticias, eventos, nosotros, calendario). Las noticias y el evento destacado se gestionan desde el panel de administración, y las imágenes se sirven desde Cloudinary.

## Capabilities and Constraints
- Inicio muestra datos reales de la API: noticias públicas (`/api/news`) y un único evento destacado (`/api/events`, `destacado = 1`).
- Las secciones públicas existentes son Noticias, Eventos, Calendario, Nosotros y Contáctanos. Las que requieren sesión son Biblioteca/catálogo, Revistas y Materiales.
- Sin conexión, Inicio debe degradarse sin errores (`ConnectivityService`).
- La transición del logo de la intro hacia el navbar al hacer scroll es una seña de identidad que se conserva.

## Brand Commitments
- Logo institucional (`public/offline/logo.png`) y el azul institucional `#3FA6E8` como ancla de color. Todo lo demás es libre.
- Nombre: "Instituto de Estudios Superiores Tiozihuatl". Lema visible: "Vocación, Fe y Esperanza".
- Tono académico y profesional.

## Evidence on Hand
- Noticias reales con imagen (inscripciones, preinscripción, trayectoria académica, bolsa de trabajo).
- Evento destacado real (7.º Congreso Nacional de Enfermería) con galería de 7 imágenes.
- Misión, visión y 7 valores en `/api/about`. No se usan en Inicio, por decisión del usuario.
- No hay matrícula, cifras, testimonios ni acreditaciones confirmadas: no inventarlos.

## Product Principles
1. Datos reales primero: nada de cifras ni testimonios inventados.
2. Llevar a la gente a la sección que busca en pocos pasos.
3. Seriedad académica sin perder calidez humana: es una escuela de cuidado.
4. Funcionar bien en móvil y sin conexión.

## Accessibility & Inclusion
Respetar `prefers-reduced-motion`, ofrecer navegación por teclado (incluido el carrusel) y cumplir el contraste WCAG AA.
