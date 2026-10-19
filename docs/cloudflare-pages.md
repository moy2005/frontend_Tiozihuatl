# Publicar la PWA en Cloudflare Pages

La rama `codex/cloudflare-pwa` prepara el frontend para alojamiento estático en
Cloudflare Pages. El backend y la base de datos continúan en Render y en su
infraestructura actual. Este cambio no publica ni modifica cuentas externas.

## 1. Conectar el repositorio

Después de hacer push de la rama, crea un proyecto **Pages** con integración Git
en Cloudflare, seleccionando el repositorio del frontend. No hace falta crear un
Worker, una Pages Function ni instalar Wrangler.

| Campo | Valor |
| --- | --- |
| Rama de producción del proyecto Pages | `codex/cloudflare-pwa` |
| Preset | `None` (configuración manual) |
| Directorio raíz | Raíz del repositorio que contiene `package.json` |
| Comando de build | `npm run build:pwa` |
| Directorio de salida | `dist/frontend/browser` |
| Node.js | 22, seleccionado por `.node-version` |

En este repositorio el frontend ya está en la raíz: deja vacío el campo de
directorio raíz. Si en el futuro se integra en un monorepo, usa la carpeta que
contenga su `package.json`. No publiques `dist/frontend` ni el código de `src`.

Pages instala las dependencias del proyecto. El build compila producción y
comprueba la integridad de los archivos antes de publicar. No configures una
variable `NODE_VERSION` que contradiga `.node-version`.

## 2. Servir el HTML y las rutas sin modificar sus bytes

Pages tiene fallback SPA nativo cuando no hay un `404.html` en la raíz del
directorio publicado. Así, `/inicio` y `/sin-conexion?volver=%2Fmateriales` cargan
la misma aplicación. Se retiraron `_redirects`, `netlify.toml` y `pwa-shell`, que
pertenecían a la solución anterior. Se conserva `public/_headers`.

Pages redirige `/index.html` a `/`; Angular puede seguir esa redirección al
precargar el documento. El contenido final debe coincidir exactamente con el
hash de `/index.html` en `ngsw.json`. No edites el worker ni el manifiesto generado.

Mantén desactivada la inyección automática de Web Analytics u otras funciones
que alteren el HTML después del build. No añadas reglas de caché CDN que retengan
HTML o manifiestos de otro despliegue. Si añades analítica después, comprueba de
nuevo la integridad del sitio publicado.

## 3. Autorizar el dominio en el backend de Render

Cuando Pages asigne el dominio definitivo, configura las variables existentes
del backend con sus valores reales. No se incluye un dominio inventado en el código.

- `ALLOWED_ORIGINS`: añade el origen HTTPS de Pages, sin ruta ni barra final,
  separado por coma de los orígenes existentes. Conserva el de Netlify mientras
  quieras mantener ambos sitios accesibles. Evita autorizar previews arbitrarias.
- `FRONTEND_URL`: al cambiar el sitio principal, usa el nuevo origen HTTPS.
  Esta variable genera enlaces de activación y recuperación, y el retorno desde OAuth.
- `RP_ID`: si utilizas autenticación con passkeys, debe corresponder al hostname
  del frontend definitivo, sin `https://` ni barra final. El backend actual deriva
  el origen WebAuthn como `https://${RP_ID}` y admite un único RP configurado.
  Las credenciales del dominio anterior no son transferibles al dominio nuevo;
  verifica el acceso alternativo y registra nuevas credenciales para ese dominio.

La API de producción sigue siendo
`https://backend-tiozihuatl-h8ig.onrender.com/api`. No cambies su URL por la de Pages.
Reinicia o redespliega el servicio de Render según corresponda tras actualizar
variables. Comprueba `/api/health`, inicio de sesión, recuperación y retorno de OAuth.
Una PWA estática puede recargar offline aunque la API no responda; CORS es necesario
para las funciones online y la descarga de las cuatro copias públicas.

## 4. Verificar el dominio publicado

Desde la raíz del frontend ejecuta, sustituyendo el marcador por el dominio real:

```powershell
npm run verify:pwa:deployed -- https://<proyecto>.pages.dev
```

El verificador solo lee: contrasta todos los recursos precargados con `ngsw.json`
y comprueba que cuatro rutas SPA entreguen el mismo HTML versionado. Si falla,
no consideres resuelta la recarga offline: revisa la salida publicada y las
transformaciones del hosting. El comando exige una URL explícita para no comprobar
accidentalmente el sitio anterior.

Después, en Chrome, Edge, Firefox y Safari donde estén disponibles:

1. Abre el nuevo dominio con conexión y espera a que termine la descarga offline.
   En un dominio nuevo se crea una instalación y un almacenamiento nuevos; la
   caché de Netlify no se transfiere a Pages.
2. En las herramientas del navegador confirma que el worker controla la página,
   que no aparece `VERSION_INSTALLATION_FAILED` y que existe el HTML en Cache Storage.
3. Desconecta la red y recarga `/sin-conexion?volver=%2Fmateriales` e `/inicio`.
   Deben mostrar la aplicación, sin 504. Abre otra pestaña en ese mismo origen.
4. Abre páginas institucionales guardadas e intenta `/materiales`: debe conservar
   la protección offline de las funciones dinámicas. Recupera la conexión y prueba
   sesión y API. Publica después otra versión para comprobar el aviso de actualización.

No habilites «Bypass for network» del worker durante esta prueba. Para funcionar
sin red, el navegador debe admitir Service Worker/Cache Storage, haber completado
la primera descarga con conexión y conservar esos datos.

## Validación local

```powershell
npm run build:pwa
npm run test:pwa
$env:PWA_BROWSER = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:pwa:offline
npm run test:pwa:offline -- --broken
$env:PWA_BROWSER = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm run test:pwa:offline
```

La prueba usa perfiles temporales y apaga el servidor antes de recargar. El caso
`--broken` es un control negativo: debe reproducir el rechazo por hash y el 504.
Las pruebas locales no certifican por sí solas un despliegue de Cloudflare.

Resultados locales de esta migración: build correcto, 1409 archivos íntegros,
106 pruebas PWA aprobadas y 115 recursos precargados en las pruebas de Chrome y
Edge. Ambos recargaron la página offline, abrieron rutas de documento y una pestaña
nueva con el servidor detenido. El control negativo reprodujo el fallo de hash y
el HTTP 504. El verificador remoto se comprobó con respuestas simuladas válidas,
HTML alterado y una ruta inexistente. Persisten advertencias previas de tamaño de
bundles, estilos y dependencias CommonJS; no impiden compilar. Firefox, Safari y
el dominio real de Pages quedan pendientes de validación.

## Referencias oficiales

- [Archivos estáticos, URLs y fallback SPA de Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Versiones de Node.js en el entorno de build](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Publicar Angular en Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/)
- [Web Analytics en Pages](https://developers.cloudflare.com/pages/how-to/web-analytics/)
