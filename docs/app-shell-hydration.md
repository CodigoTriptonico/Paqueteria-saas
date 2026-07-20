# Contrato de hidratación del app shell

`AppFrame` usa `usePathname()` para derivar la navegación contextual. Esa lectura puede no coincidir entre el prerender del servidor y la primera lectura del navegador, por ejemplo durante rewrites o navegación inicial de desarrollo.

La cabecera debe conservar el mismo arbol durante SSR y el primer render del cliente:

- Antes de hidratar, `BoxarioBrandHeader` muestra el enlace de marca con su `h1`.
- Después de hidratar, puede mostrar el botón de volver y el título contextual.
- El estado se obtiene de `useHydrated()`, basado en `useSyncExternalStore` con snapshot de servidor `false`.
- No se debe reemplazar esta protección con una lectura directa de `window`, `document`, `Date.now()` o estado inicial calculado en el navegador.

La prueba gate renderiza la cabecera con `react-dom/server`. La eval verifica que `AppFrame` y la cabecera sigan usando el mismo contrato.
