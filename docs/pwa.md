# PWA: funcionamiento técnico

## Service worker

Se usa el service worker oficial de Angular (`ngsw-worker.js`), configurado en
`ngsw-config.json`. Solo se registra en producción, cuando la aplicación se estabiliza
o tras 30 segundos (`registerWhenStable:30000`), y requiere HTTPS.

- **Precarga:** shell de la aplicación (`index.html`, JS, CSS), manifiesto, iconos,
  fuentes locales, recursos de `public/offline` y los iconos usados por las páginas
  institucionales.
- **Carga diferida:** el resto de iconos de `assets/ionicons`.
- **Navegación:** `navigationRequestStrategy: performance`; cualquier ruta de la SPA se
  resuelve offline con el `index.html` precargado. `/api` y `/uploads` quedan excluidos.
- **Sin `dataGroups`:** ninguna respuesta de la API se guarda en Cache Storage.

El service worker valida cada recurso contra los hashes de `ngsw.json`. Si el hosting
altera el HTML después del build, la versión se rechaza y la recarga offline falla.
Por eso no deben inyectarse scripts ni comentarios en el HTML publicado.

## Contenido disponible sin conexión

Las respuestas públicas de `/about`, `/contact`, `/privacidad` y `/terminos` se guardan en
IndexedDB (sin credenciales) con una vigencia de 30 días. Con conexión se consulta
primero al servidor; ante un fallo temporal se muestra la copia con su fecha. Una
respuesta 4xx invalida la copia.

El resto de servicios (catálogo, revistas, préstamos, pagos, perfil, administración y
asistente) requiere conexión: `online.guard` impide el acceso offline y, si la conexión se
pierde dentro de una de esas pantallas, se redirige a `/sin-conexion`. No se encolan ni
reenvían escrituras.

## Conectividad

`ConnectivityService` combina los eventos `online`/`offline` del navegador con
`GET /api/health` (límite de 8 s) al arrancar, al recuperar la red, al volver a la pestaña
y cada minuto mientras está visible. Distingue tres estados: en línea, sin conexión y
API no disponible. El endpoint de salud está fuera del rate limit del backend.

## Actualizaciones

Cuando hay una versión nueva se muestra un aviso y la recarga la decide la persona usuaria;
nunca se fuerza durante el uso. También se informan los fallos de actualización y de
almacenamiento.

## Notificaciones

| Pieza | Ubicación |
| --- | --- |
| Suscripción Web Push | `src/app/pwa/push-notification.service.ts` |
| Avisos de conexión del sistema | `src/app/pwa/system-notification.service.ts` |
| Bandeja dentro del portal | `src/app/api/services/notificaciones.service.ts` |
| API | `/api/notifications` en el backend |

Flujo:

1. La persona activa los avisos desde la campana o el menú de perfil. El permiso se pide
   dentro del clic, antes de cualquier petición de red.
2. Con sesión iniciada, se obtiene la clave pública (`GET /notifications/public-key`), se
   crea la suscripción y se registra en `POST /notifications/subscribe`.
3. El backend envía con `web-push` un payload `{ notification: {...} }` que muestra el
   service worker de Angular; `data.onActionClick` abre la ruta indicada.
4. Al cerrar sesión se revoca la suscripción en el navegador y en el backend; la siguiente
   cuenta del dispositivo debe activarlos de nuevo.

Si el backend no tiene claves VAPID, la campana indica que los avisos del Instituto no
están disponibles y se conservan los avisos locales de conexión y la bandeja.

Envíos del backend: avisos del administrador (a todos, por rol o a un usuario), cambios de
estado de préstamos y recordatorio de préstamos por vencer (lunes a viernes, 9:00, hora de
Ciudad de México).

## Búsqueda por voz

El catálogo admite dictado en español mediante `SpeechRecognition` cuando el navegador lo
ofrece en contexto seguro. Solo inicia al pulsar el botón, se limita a una frase y 20
segundos y no guarda audio. `public/_headers` permite el micrófono en el propio origen.

## Pruebas

```bash
npm run test:pwa
npm run build:pwa
```

`build:pwa` ejecuta `scripts/verify-pwa.mjs`, que comprueba manifiesto, iconos, integridad
de los archivos frente a `ngsw.json`, exclusión de la API de la caché y la URL HTTPS de la API.

## Pendiente de validar en dispositivos reales

- Instalación y modo standalone en Android, iOS y escritorio.
- Recepción de push real con las claves VAPID de producción.
- Firefox y Safari (las pruebas automatizadas usan Chromium).
- Dictado por voz con permiso concedido, denegado y sin micrófono.
