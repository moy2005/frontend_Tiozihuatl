---
version: 1
slug: "src-app-pages-inicio-inicio-html"
primary_target: "src/app/pages/inicio/inicio.html"
related_targets: []
---

# Inicio (/inicio)

Scope: página pública de inicio. Mode: Persuade.
Audiencia: estudiantes (aspirantes y alumnos) primero; docentes y visitantes también. Acción: ver lo más reciente (evento destacado, noticias) y llegar en un paso a la sección que buscan.
Contenido: solo datos de la API (noticias, evento destacado) y accesos a rutas existentes. Sin cifras ni testimonios inventados.
Restricciones: se conservan el logo, el azul #3FA6E8 y la intro con el logo que viaja al navbar; modo sin conexión; prefers-reduced-motion.
Historial: la dirección «Lámina académica» se construyó y el usuario la rechazó ("no me gusta el diseño ni las fuentes"). Esta ronda se eligió viendo bocetos renderizados.

## Direction contract

THESIS: Inicio es el periódico mural del instituto: un tablero de fieltro azul institucional donde cada aviso real (lema, congreso, noticias, secciones) es un papel clavado o pegado con cinta que se puede tomar. Rechaza el hero con foto y velo sobre una fila de tarjetas iguales.

OWN-WORLD: fieltro azul (#2B86C6, con textura de fieltro) como fondo de toda la página, papeles blanco cálido (#FFFDF8) con sombras de elevación neutras, notas adhesivas en amarillo (#FFF3A6), celeste (#D8EFFF), rosa (#FFE3DF) y verde (#E5F6E9), cinta translúcida y chinchetas rojas (#E8443A). Tinta azul noche (#0B2A4A) para el texto. Bricolage Grotesque gruesa para titulares, Hanken Grotesk para el texto y Caveat solo en notas manuscritas breves.

STORY: el visitante reconoce el instituto (cartel con el nombre), ve armarse el mural con el lema, el congreso clavado y los avisos más recientes, toma el aviso que le interesa y encuentra su sección en las fichas del tablero.

FIRST VIEWPORT: tablero azul con el logo grande y un cartel de papel con el nombre del instituto, sujeto con cinta. Al desplazar, el cartel se desprende, el logo viaja al navbar y se clavan en secuencia: el papel grande del lema a la izquierda (con la acción principal «Ver el evento destacado»), el flyer del congreso con su chincheta a la derecha, notas de Noticias y del aviso más reciente, y fichas de secciones abajo.

FORM: periódico mural escolar, puesto 7 de mi lista ordenada; seed:6d4f80b7c0164a7d. Gramática de movimiento: los papeles entran en una sola línea de tiempo de scroll y se clavan (la chincheta aparece al final del trazo); bajo el pliegue, los avisos caen en cascada rítmica al entrar en vista. La chincheta roja es la única marca de lo activo. Raises: entrada rítmica en cascada (tablero split-flap), una sola marca para lo activo (jackfield).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
