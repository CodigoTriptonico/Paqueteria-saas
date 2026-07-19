# Sesión y experiencia móvil

## Resultado observable

- Un usuario autenticado que abre `/login` vuelve a la ruta interna solicitada o a Inicio.
- Las rutas públicas se comparan por segmento completo. Una ruta parecida, como `/login-admin`, no se vuelve pública por accidente.
- Cerrar sesión conserva primero la protección de entregas offline del conductor, limpia sus datos privados locales y elimina las cookies de Supabase antes de volver a `/login`.
- El menú `Más` del teléfono reutiliza los mismos grupos y el mismo estado persistido del menú lateral. Los grupos empiezan contraídos y se pueden expandir individualmente.
- En Nueva venta, `Logística` se muestra completa y el control de carrito reduce contenido secundario en pantallas pequeñas para no desbordar el paso.

## Fronteras de responsabilidad

`src/proxy.ts` solo hace la comprobación optimista de sesión, refresca cookies y protege rutas. La autorización de organización, rol y permiso continúa en la capa de sesión y en `requirePathAccess()`.

`signOutAction()` sigue siendo la única salida autenticada. `UserAccountMenu` la ejecuta únicamente después de comprobar que no existan operaciones del conductor pendientes de sincronizar. No existe un endpoint GET alternativo que duplique el cierre de sesión.

Las rutas públicas se resuelven en `src/lib/auth/proxy-paths.ts`. La redirección desde `/login` solo acepta rutas internas saneadas.

## Evidencia automatizada

- `src/lib/auth/proxy-paths.test.ts`: límites exactos de rutas públicas y rechazo de redirecciones externas.
- `src/lib/auth/clear-auth-cookies.test.ts`: selección de cookies de sesión Supabase.
- `src/lib/auth-session-flow.eval.test.ts`: orden del guard offline, limpieza de cookies y responsabilidad del proxy.
- `src/lib/app-shell-sidebar.eval.test.ts`: grupos móviles colapsables y estado compartido.
- `src/lib/sale-cart-panel-cleanup.eval.test.ts`: contrato de ancho del carrito móvil.
- `src/lib/sale-step-labels.test.ts`: etiqueta completa `Logística`.

La entrega se valida con `npm run test:gate`, `npm run test:eval`, `npm run check:code` y `npm run build`.
