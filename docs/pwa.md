# PWA para producción HTTPS

## Incidencia de actualización del 7 de octubre de 2026

Se revisó `https://frontiozihuatl.netlify.app`. De 112 recursos de precarga, solo `/index.html` no coincidía con su huella en `ngsw.json`. El HTML servido incluía un comentario de Netlify que no existía en el build. Al eliminar únicamente ese comentario de la respuesta, el SHA-1 coincidió exactamente con el declarado:

- Esperado: `5ca5c53e45ee823a31e5f52d60e075524371f3f9`.
- Servido: `a9baf0131b2765db5782c98cc675b1752d19873f`.

La misma diferencia persistió usando una URL de cache busting. Angular rechaza una versión cuyos archivos no coinciden; recargar no corrige una transformación del servidor. La API `/api/health` respondió 200, con CORS correcto, en unos 350 ms durante la comprobación. Esto no descarta arranques lentos u otros problemas intermitentes. Tampoco demuestra que toda demora del inicio proceda del worker; el bundle inicial del proyecto sigue siendo grande.

Se añadió `netlify.toml` con el build verificado, directorio publicable y `skip_processing = true`; `_headers` solicita `no-transform`. Estas son medidas de configuración, no una confirmación de que se haya desactivado la inyección en la cuenta publicada. No se modificó la cuenta ni se desplegó. Si se publica arrastrando únicamente `dist/frontend/browser`, el TOML del repositorio no configura ese despliegue: revisar también las opciones del proyecto en Netlify.

Al publicar desde Git, la base del proyecto Netlify debe ser la carpeta del frontend que contiene `package.json` y `netlify.toml`. Publicar el build completo y evitar cualquier transformación posterior del HTML. Revisar Project configuration > Developer settings > Post processing > Snippet Injection y desactivar cualquier inyección que modifique el documento. Si el comentario automático sigue presente pese a la configuración, debe deshabilitarse en el proveedor o consultarse con soporte. No se debe eliminar la verificación de hashes ni editar `ngsw.json` para esconder el fallo.

Después de publicar, ejecutar desde el frontend:

```powershell
npm run verify:pwa:deployed -- https://frontiozihuatl.netlify.app
```

El comando solo lee el sitio, comprueba todos sus recursos de precarga con concurrencia limitada y devuelve error si el hosting alteró un archivo. Detecta específicamente el comentario observado. Mientras falle esta comprobación, la causa del error publicado no está resuelta. Cuando pase, las pestañas existentes podrán descargar la versión correcta; una actualización lista se aplica al recargar voluntariamente.

Los avisos separan ahora actualización lista, comprobación fallida y recuperación obligatoria. Los errores temporales se limpian tras una comprobación correcta y ofrecen reintentar, sin pedir recargar. Los avisos informativos se pueden cerrar o posponer; el botón «Ver avisos» permite recuperarlos. Un cambio de versión o una nueva desconexión vuelve a avisar. Una versión irrecuperable permanece visible y nunca se recarga automáticamente. El cierre solo dura durante la sesión de la página.

Validación de este ajuste: 19 pruebas dirigidas aprobadas, build de producción y verificación de integridad local correctos (1406 archivos), revisión visual de escritorio y ancho móvil de 390 px, cierre y recuperación de avisos comprobados. La prueba visual se hizo en un origen de desarrollo sin autorización CORS de producción, por lo que el aviso de servicio no disponible y las copias públicas pendientes eran esperados allí. No se modificó CORS para esa prueba. El verificador remoto reprodujo el fallo del HTML del sitio publicado.

La interfaz de `/sin-conexion` usa la paleta y tipografías de Nosotros, tarjetas por página y estados de descarga. «Comprobar descarga» permanece en esta pantalla si no hay un servicio de retorno solicitado. Los estilos de avisos respetan movimiento reducido y navegación por teclado.

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

## Configuración del despliegue futuro

No se ha desplegado la aplicación. Al publicarla:

1. Publicar el frontend y el backend con certificados HTTPS válidos. Mantener la URL real de API en `environment.prod.ts` antes de compilar.
2. Establecer `NODE_ENV=production` y `ALLOWED_ORIGINS` en el backend con los orígenes HTTPS exactos del frontend, separados por comas, sin rutas ni barra final. El backend rechaza una configuración de producción vacía o no HTTPS. Conservar las demás variables de autenticación, sesiones, base de datos y pagos del proyecto.
3. Incluir el nuevo `/api/health` del backend. No protegerlo con sesión ni sustituir su JSON por HTML. El frontend y esta versión de la API deben publicarse de forma coordinada; una API antigua sin ese endpoint se considera no disponible.
4. Publicar juntos todos los archivos de `dist/frontend/browser`, incluidos `ngsw.json`, `ngsw-worker.js`, manifiesto, imágenes, fuentes y `assets/ionicons`.
5. Servir archivos reales antes del fallback de Angular. Las rutas de la aplicación deben resolver a `index.html`; archivos inexistentes, `/api` y `/uploads` no deben convertirse en HTML. Mantener los MIME de JavaScript, JSON/webmanifest, SVG, fuentes e imágenes.
6. Aplicar `Cache-Control: no-cache` a HTML, manifiesto y archivos del worker. Reservar caché larga para archivos con hash. El backend responde con `no-store` para API y uploads. No añadir una regla CDN que almacene respuestas privadas.
7. Aplicar `Permissions-Policy: microphone=(self)` en el frontend. `public/_headers` lo declara para los proveedores que interpretan ese archivo y `src/server.ts` lo configura para el servidor Angular/Express. En otro hosting se necesitan reglas equivalentes; el archivo por sí solo no configura todos los proveedores. Cualquier CSP adicional debe permitir los recursos existentes y la API HTTPS.

El proyecto conserva su modelo de compilación actual; no se activó SSR como parte de la PWA. Para publicar en un subdirectorio se deben adaptar base, manifiesto, alcance y rutas antes de compilar.

## Verificación pendiente en el dominio definitivo

- Instalar y abrir en los navegadores y teléfonos objetivo; verificar identidad, iconos y modo standalone.
- Esperar la confirmación de descarga completa, activar modo avión y abrir directamente cada página institucional. Intentar catálogo y trámites, y perder conexión dentro de una pantalla dinámica.
- Recuperar la conexión, verificar CORS, cookies de sesión y errores reales de API sin reenvío de operaciones.
- Probar micrófono concedido, denegado y no disponible en los dispositivos objetivo.
- Publicar una siguiente versión de prueba y comprobar el aviso y la recarga explícita.

Estas comprobaciones requieren el despliegue y dispositivos reales; las pruebas automatizadas no las sustituyen.

## Recursos

Se reutilizó el logo institucional previamente referenciado por el proyecto, conservando su diseño y proporciones. Los PNG de instalación y el logo de las páginas se sirven localmente. La variante maskable mantiene el emblema dentro de su zona segura. Las imágenes legales se incorporaron desde las referencias originales del proyecto. Las fuentes e iconos proceden de las dependencias fijadas en el lockfile.

## Verificación realizada durante el desarrollo

- Compilación de producción y verificador PWA correctos; integridad de 1406 archivos y cinco iconos validada. Se conservan advertencias existentes de tamaño, estilos y dependencias CommonJS.
- 17 pruebas dirigidas correctas en ChromeHeadless: selección de datos públicos, vigencia de copias, errores de almacenamiento, bloqueo de operaciones, conectividad, rutas, actualizaciones y reconocimiento de voz simulado.
- Navegador con una copia aislada del build y API simulada: worker activado, 118 recursos almacenados y cero respuestas de API en Cache Storage. IndexedDB contenía exactamente las cuatro páginas públicas.
- Con el servidor de esa prueba detenido, se abrieron Nosotros, privacidad, términos y contacto desde la descarga, sin visitarlos previamente. Se mostraron fecha de copia y aviso de servicio no disponible; el mapa quedó sustituido por su mensaje de conexión y el catálogo redirigió a `/sin-conexion`.
- Sintaxis del backend y revisión de espacios del diff correctas. No se inició la base de datos ni se ejecutaron cron, pagos o acciones sobre cuentas reales.

La API simulada y su dirección de prueba existen únicamente en una copia temporal ignorada por Git; el build entregable conserva la API HTTPS de producción. Esta comprobación no equivale a probar instalación móvil, reconocimiento de voz real ni el hosting definitivo.

También se comprobó la recuperación al reiniciar el servidor de prueba y el aviso de una nueva versión del worker, manteniendo la página abierta hasta solicitar la recarga.
