# Despliegue en Cloudflare Pages

El frontend se publica como sitio estático en Cloudflare Pages. La API y la base de datos
siguen en Render.

## Configuración del proyecto Pages

| Campo | Valor |
| --- | --- |
| Rama de producción | `feat/cloudflare-pwa` |
| Preset | `None` |
| Directorio raíz | (vacío, raíz del repositorio) |
| Comando de build | `npm run build:pwa` |
| Directorio de salida | `dist/frontend/browser` |
| Node.js | 22, tomado de `.node-version` |

No se requieren Workers, Pages Functions ni Wrangler. No definas `NODE_VERSION` con un
valor distinto de `.node-version`.

## Rutas y encabezados

- Pages aplica su fallback SPA porque no se publica un `404.html` en la raíz: cualquier
  ruta (`/inicio`, `/sin-conexion?volver=...`) entrega `index.html`.
- `public/_headers` define `Cache-Control: no-cache, no-transform` y
  `Permissions-Policy: microphone=(self)`.
- Mantén desactivadas Web Analytics automática y cualquier función que modifique el HTML
  tras el build: el service worker rechazaría la versión por hash distinto.

## Variables del backend (Render)

Las variables se configuran en el panel de Render; el `.env` local no se despliega.

| Variable | Valor |
| --- | --- |
| `ALLOWED_ORIGINS` | Orígenes HTTPS del frontend separados por coma, sin barra final |
| `FRONTEND_URL` | Origen HTTPS principal (enlaces de correo y retorno de OAuth) |
| `RP_ID` | Hostname del frontend para passkeys, sin `https://` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Claves de Web Push |

Las passkeys registradas en un dominio anterior no sirven en el nuevo; cada persona
debe registrarlas de nuevo. Tras cambiar variables, redespliega el servicio en Render.

## Verificación después de publicar

```bash
npm run verify:pwa:deployed -- https://<dominio-de-pages>
```

El comando solo lee el sitio: compara cada recurso precargado con `ngsw.json` y comprueba
que las rutas SPA entreguen el mismo HTML versionado.

Comprobación manual en el navegador:

1. Abrir el sitio con conexión y esperar a que el pie de página indique la descarga
   offline completa.
2. En DevTools › Application, confirmar que el service worker controla la página.
3. Activar modo sin conexión y recargar `/inicio`, `/about` y `/sin-conexion`.
4. Intentar `/materiales`: debe redirigir a `/sin-conexion`.
5. Restablecer la conexión y probar inicio de sesión, CORS y activación de notificaciones.
6. Publicar otra versión y comprobar el aviso de actualización.
