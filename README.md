# Portal del Instituto de Estudios Superiores Tiozihuatl

Aplicación web progresiva (PWA) del Instituto de Estudios Superiores Tiozihuatl (IEST).
Reúne el portal institucional y los servicios de la biblioteca: catálogo bibliográfico,
revistas digitales, préstamos, materiales docentes, pagos y la administración del sistema.

## Arquitectura

| Componente | Tecnología | Alojamiento |
| --- | --- | --- |
| Frontend (este repositorio) | Angular 20 (standalone, signals), Tailwind CSS, `@angular/service-worker` | Cloudflare Pages, sitio estático |
| API REST | Node.js + Express 5, repositorio `backend_Tiozihuatl` | Render |
| Base de datos | MySQL | Proveedor gestionado |
| Archivos | Cloudinary | — |

El frontend se publica como sitio estático (sin SSR) en la raíz del dominio y consume
la API mediante la URL HTTPS absoluta definida en
`src/app/api/environments/environment.prod.ts`.

## Funcionalidad

- **Portal público:** inicio, nosotros, contacto, noticias, eventos, calendario académico,
  aviso de privacidad, términos y seguridad.
- **Biblioteca:** catálogo con búsqueda por texto y por voz, detalle de libros, revistas
  digitales con carrito y pago, préstamos y materiales docentes con recomendaciones.
- **Cuenta:** registro con verificación de correo, inicio de sesión con contraseña,
  OAuth, SMS y passkeys (WebAuthn), recuperación de contraseña y perfil.
- **Administración** (`/admin`): usuarios, contenido institucional, libros, revistas,
  pagos y descuentos, periodos y materias, reportes, monitoreo de la base de datos,
  mantenimiento, respaldos y notificaciones.

## Capacidades PWA

- Instalable (manifiesto, iconos y modo `standalone`).
- Recarga y navegación sin conexión del shell de la aplicación.
- Consulta offline de las páginas institucionales (nosotros, contacto, privacidad y términos).
- Aviso de conexión, de API no disponible y de nueva versión disponible.
- Notificaciones push (Web Push con VAPID) y bandeja de notificaciones dentro del portal.

El detalle técnico está en [docs/pwa.md](docs/pwa.md).

## Estructura

```text
src/app/
  api/            Servicios HTTP, modelos y entornos
  auth/ guards/   Autenticación y protección de rutas
  interceptors/   Token de acceso y reintentos
  components/     Navbar, pie de página, campana de notificaciones, asistente virtual
  pages/          Páginas públicas, de biblioteca y de administración
  pwa/            Service worker, conectividad, contenido offline, push y búsqueda por voz
public/           Manifiesto, iconos, recursos offline y _headers de Cloudflare
scripts/          Verificación del build y del sitio publicado
ngsw-config.json  Configuración del service worker
```

## Desarrollo

Requiere Node.js 22 (ver `.node-version`).

```bash
npm ci
npm start
```

La aplicación queda en `http://localhost:4200/` y usa la API local
`http://localhost:4000/api`. En desarrollo el service worker está desactivado.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor de desarrollo |
| `npm run build:pwa` | Build de producción y verificación de la PWA |
| `npm run test:pwa` | Pruebas unitarias de la capa PWA (ChromeHeadless) |
| `npm test` | Todas las pruebas unitarias |
| `npm run verify:pwa:deployed -- https://<dominio>` | Verifica la integridad del sitio publicado |

## Despliegue

La rama `feat/cloudflare-pwa` se publica en Cloudflare Pages. Configuración, variables
del backend y verificación posterior: [docs/cloudflare-pages.md](docs/cloudflare-pages.md).
