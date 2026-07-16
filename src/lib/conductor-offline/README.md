# Cola offline del conductor

La confirmación de una tarea termina para el conductor cuando IndexedDB confirma la escritura local. La red nunca forma parte de esa espera.

## Garantías

- La foto y el resultado sobreviven a recargas y cierres del navegador.
- Solo existe una operación local activa por tarea, organización, usuario y conductor.
- Un ACK del servidor cambia la operación a `synced` y elimina el `Blob` de la foto.
- La operación se conserva hasta que el siguiente refresco confirme que la tarea ya aparece cerrada en el servidor.
- Errores de red, `408`, `425`, `429` y `5xx` se reintentan con backoff.
- Errores permanentes quedan visibles como `needs_attention` y no bloquean el resto de la cola.

## Sincronización

El cliente intenta sincronizar al montar, al recuperar conexión, al volver a primer plano y periódicamente mientras la pantalla está abierta. En navegadores compatibles también registra Background Sync. `public/sw.js` procesa la misma base IndexedDB si la aplicación está cerrada.

Nunca se debe borrar esta base al actualizar el service worker. Al cerrar sesión, la UI debe impedir la salida si todavía existen operaciones sin confirmar.
