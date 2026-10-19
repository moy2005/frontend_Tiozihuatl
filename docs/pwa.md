# PWA para producción HTTPS

## Recarga offline y entrega del HTML

El worker oficial conserva `navigationRequestStrategy: performance`: una navegación
a `/sin-conexion?volver=%2Fmateriales` se resuelve con el `/index.html` precargado.
No se usa detección de navegador ni un worker alternativo. Se requiere HTTPS
(o localhost en pruebas), soporte de Service Worker/Cache Storage y una primera
descarga completa con conexión. La disponibilidad depende también de que el
navegador conserve el almacenamiento; no se garantiza para navegadores antiguos
o con estas capacidades deshabilitadas.

Esta rama publica directamente los archivos estáticos en Cloudflare Pages. Se
conservan los hashes de Angular y su worker generado. Las rutas se resuelven con
el fallback SPA nativo de Pages; no se publica un archivo raíz `404.html`, una
función de entrega del HTML ni las reescrituras específicas de Netlify.
Consulta [despliegue en Cloudflare Pages](cloudflare-pages.md) para configurar el
build, el backend en Render y comprobar la integridad después de publicar.

El sitio anterior en Netlify devolvía un comentario añadido después del build.
La diferencia se observó tanto en `/index.html` como en la respuesta de la función
`pwa-shell`; esa alternativa no resolvió el problema publicado. Angular rechaza
el HTML alterado por no coincidir con `ngsw.json`. Sin una versión válida que
sirva la navegación desde caché, la petición de red falla offline y produce 504.
Por eso esta rama retira la función y no elimina la validación de integridad.

Los errores de versión se conservan aunque `checkForUpdate()` resuelva `false`;
un fallo de actualización no deshabilita por sí solo la versión anterior usable.
Los avisos distinguen actualización lista, comprobación fallida y recuperación
obligatoria. No se fuerza una recarga durante el uso.

**Pruebas locales**, después de `npm run build:pwa`:

```powershell
$env:PWA_BROWSER = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:pwa:offline
npm run test:pwa:offline -- --broken
$env:PWA_BROWSER = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm run test:pwa:offline
```

La prueba requiere Node.js 22 o posterior y usa un perfil temporal aislado y el
navegador instalado, sin dependencias adicionales. Sirve el build estático,
simula la redirección canónica de `/index.html` a `/`, espera la precarga y detiene
el servidor. Comprueba recarga con parámetros, rutas institucionales, bloqueo de
`/materiales` y apertura de una pestaña nueva, con respuestas de documento 200.
`--broken` altera el HTML de arranque y exige observar Hash mismatch y HTTP 504.
La simulación local no sustituye la prueba del dominio publicado.
El ejecutor automatizado usa CDP (Chromium); eso no limita la implementación de la
PWA. Firefox y Safari requieren además validación manual en sus plataformas.

## Comportamiento

La aplicación usa el service worker oficial de Angular 20.3.4, manifiesto local y presentación `standalone`. Se registra únicamente en producción, cuando la aplicación se estabiliza o después de 30 segundos. La identidad, el alcance y las rutas presuponen publicación en la raíz del dominio.

El worker precarga la aplicación, el manifiesto, los iconos institucionales, las fuentes y los recursos visuales de las páginas públicas. Los iconos adicionales se descargan cuando se necesitan; los referenciados por el contenido institucional se preparan antes de anunciar la descarga completa. Los bundles incluyen componentes dinámicos porque el proyecto importa sus rutas directamente; esto no almacena sus datos.

Se descargan automáticamente Nosotros, contacto, privacidad y términos desde los GET públicos `/about`, `/contact`, `/privacidad` y `/terminos`. Se guardan exclusivamente esas respuestas en IndexedDB, sin autorización ni cookies, identificadas por URL de API, fecha y estructura esperada. La copia vence a los 30 días. Con conexión se consulta primero el servidor; ante un fallo temporal se usa una copia válida y se informa su fecha. Una respuesta 4xx invalida la copia anterior. Inicio conserva su contenido institucional y Seguridad su contenido estático; noticias, eventos y mapas necesitan conexión.

El pie de página contiene **Uso sin conexión**, con el estado de la descarga y enlaces a las páginas guardadas. Solo se anuncia la descarga completa cuando el worker controla la aplicación, existen las cuatro copias válidas y están preparados sus iconos. Se requiere una primera visita con conexión y suficiente almacenamiento. El navegador puede liberar estos datos; no se promete disponibilidad si la descarga quedó incompleta o la copia venció.

No hay `dataGroups` de API en `ngsw-config.json`. Catálogo, documentos, perfil, compras, préstamos, administración, asistente y demás servicios dinámicos quedan fuera del uso offline. Un guard impide entrar y la pérdida de conectividad dentro de una pantalla dinámica lleva a la página de información offline. No se encolan ni reenvían escrituras automáticamente. Si un pago o solicitud pierde conexión después de enviarse, se debe consultar su estado antes de repetirlo.

El aviso accesible distingue red desconectada de API no disponible, permite reintentar y confirma la recuperación. El frontend comprueba `/api/health` al arrancar, recuperar red, volver a la pestaña y cada minuto mientras está visible. La comprobación tiene un límite de ocho segundos y no renueva la sesión. Este endpoint comprueba que la API responde, no la salud de cada dependencia o de la base de datos. Los errores de sesión conservan su manejo de autenticación separado.

Las actualizaciones muestran un aviso y se aplican mediante una recarga solicitada por la persona, con advertencia sobre formularios y operaciones pendientes. No se fuerza una recarga durante el uso. También se muestran los fallos de actualización y almacenamiento.

## Búsqueda por voz

El catálogo permite dictar una búsqueda en español mediante `SpeechRecognition` o `webkitSpeechRecognition` cuando el navegador los ofrece en un contexto seguro. Solo empieza al pulsar el botón y solicita el permiso del navegador. Se limita a una frase y 20 segundos; se detiene al cancelar, salir, ocultar la pestaña o perder conexión. Gestiona permiso denegado, falta de voz, micrófono y errores de red. El texto reconocido pasa al mismo buscador, con límite de 200 caracteres y cancelación de búsquedas anteriores.

La aplicación no graba ni guarda archivos de audio. El reconocimiento puede utilizar servicios externos del navegador, indicado junto al botón. La búsqueda escrita continúa disponible si el navegador no ofrece reconocimiento. HTTPS es necesario, pero no garantiza que todos los navegadores o PWA instaladas soporten esta API.

## Compilación y validación

```powershell
npm ci
npm run test:pwa
npm run build:pwa
```

`test:pwa` ejecuta las pruebas dirigidas en ChromeHeadless. `build:pwa` compila producción y ejecuta `verify:pwa`, que comprueba manifiesto, tamaños de iconos, integridad de archivos, reglas de almacenamiento, recursos locales y URL HTTPS de la API. El resultado publicable está en `dist/frontend/browser`. No editar los archivos compilados ni `ngsw.json` manualmente.

El script `preview:pwa` es una utilidad de desarrollo opcional, no un requisito ni un servidor del despliegue. La configuración de producción usa la API HTTPS de `src/app/api/environments/environment.prod.ts`; no depende de un servidor en el equipo del visitante.

## Configuración del despliegue

El destino de esta rama es Cloudflare Pages; el backend continúa en Render.
La [guía de publicación](cloudflare-pages.md) incluye los ajustes exactos del
proyecto y las variables de dominio del backend. El despliegue en Cloudflare
queda pendiente hasta publicar la rama y configurar el proyecto.

Se publica únicamente `dist/frontend/browser` en la raíz del dominio, sin SSR.
La API sigue usando su URL HTTPS absoluta y queda fuera de la caché de Angular.
`public/_headers` conserva `no-cache, no-transform` y el permiso de micrófono.
Pages sirve los archivos y aplica su fallback SPA a rutas sin archivo; no debe
usarse el dominio del frontend como sustituto del servidor API o de uploads.

## Verificación pendiente en el dominio definitivo

- Instalar y abrir en los navegadores y teléfonos objetivo; verificar identidad, iconos y modo standalone.
- Esperar la confirmación de descarga completa, activar modo avión y abrir directamente cada página institucional. Intentar catálogo y trámites, y perder conexión dentro de una pantalla dinámica.
- Recuperar la conexión, verificar CORS, cookies de sesión y errores reales de API sin reenvío de operaciones.
- Probar micrófono concedido, denegado y no disponible en los dispositivos objetivo.
- Publicar una siguiente versión de prueba y comprobar el aviso y la recarga explícita.

Estas comprobaciones requieren el despliegue y dispositivos reales; las pruebas automatizadas no las sustituyen.

## Recursos

Se reutilizó el logo institucional previamente referenciado por el proyecto, conservando su diseño y proporciones. Los PNG de instalación y el logo de las páginas se sirven localmente. La variante maskable mantiene el emblema dentro de su zona segura. Las imágenes legales se incorporaron desde las referencias originales del proyecto. Las fuentes e iconos proceden de las dependencias fijadas en el lockfile.

## Verificación previa a la migración de hosting

- Compilación de producción y verificador PWA correctos; integridad de 1406 archivos y cinco iconos validada. Se conservan advertencias existentes de tamaño, estilos y dependencias CommonJS.
- 17 pruebas dirigidas correctas en ChromeHeadless: selección de datos públicos, vigencia de copias, errores de almacenamiento, bloqueo de operaciones, conectividad, rutas, actualizaciones y reconocimiento de voz simulado.
- Navegador con una copia aislada del build y API simulada: worker activado, 118 recursos almacenados y cero respuestas de API en Cache Storage. IndexedDB contenía exactamente las cuatro páginas públicas.
- Con el servidor de esa prueba detenido, se abrieron Nosotros, privacidad, términos y contacto desde la descarga, sin visitarlos previamente. Se mostraron fecha de copia y aviso de servicio no disponible; el mapa quedó sustituido por su mensaje de conexión y el catálogo redirigió a `/sin-conexion`.
- Sintaxis del backend y revisión de espacios del diff correctas. No se inició la base de datos ni se ejecutaron cron, pagos o acciones sobre cuentas reales.

La API simulada y su dirección de prueba existen únicamente en una copia temporal ignorada por Git; el build entregable conserva la API HTTPS de producción. Esta comprobación no equivale a probar instalación móvil, reconocimiento de voz real ni el hosting definitivo.

También se comprobó la recuperación al reiniciar el servidor de prueba y el aviso de una nueva versión del worker, manteniendo la página abierta hasta solicitar la recarga.
