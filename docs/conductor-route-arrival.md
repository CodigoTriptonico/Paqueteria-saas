# Llegada del conductor a bodega

## Resultado operativo

La ruta no termina sola después de la última visita. Cuando todas las visitas tienen resultado, el conductor ve un solo paso grande: `Llegué a bodega`.

El conductor confirma:

1. La bodega donde dejó la ruta.
2. La razón del cierre: terminó todo, quedaron entregas, problema con el camión u otra razón.
3. Una explicación corta únicamente si eligió otra razón o llegó a una bodega distinta de la planeada.

Al confirmar, la ruta queda `completed` y conserva por separado la bodega planeada y la bodega real. El ingreso a bodega usa la bodega real y no permite recibir esa ruta desde otra ubicación.

## Interfaz

- El botón solo aparece cuando la ruta está en curso y todas sus visitas tienen resultado.
- La pantalla usa botones grandes con icono y texto. No depende únicamente del color.
- La bodega planeada queda marcada de antemano para que una llegada normal requiera pocos toques.
- Si hubo visitas fallidas o canceladas, `Terminé todo` queda deshabilitado.
- El conductor puede cancelar con `Todavía no` sin perder ni cerrar nada.
- Un error aparece dentro de la misma ventana y permite volver a tocar `Sí, terminar ruta`.

La confirmación requiere conexión. Si no hay señal, el sistema no finge que la bodega fue avisada; mantiene la selección visible y pide intentar de nuevo cuando regrese la red.

## Custodia y auditoría

`complete_conductor_route_arrival` guarda actor, hora capturada, hora confirmada, bodega real, razón, nota y una clave idempotente. También escribe `logistics.route_arrived_at_warehouse` en el historial. La migración 121 prioriza el mensaje de visitas abiertas para indicarle al conductor exactamente qué debe terminar.

La llegada marca `truck_arrived_at`, pero cada caja continúa como `in_truck` y bajo custodia del conductor. La custodia pasa a bodega únicamente cuando el encargado escanea físicamente la caja en Ingreso a bodega. La migración 122 hace determinista ese custodio incluso cuando creación y escaneo comparten la misma marca de tiempo.

## Verificación

```powershell
npx.cmd tsx --test src/lib/conductor-route-arrival.test.ts
npx.cmd tsx --test src/lib/logistics-route-completion.eval.test.ts
npm.cmd run db:check
npm.cmd run db:apply
npm.cmd run test:route-arrival-db
```

La prueba de base de datos crea rutas, paradas, cajas y una bodega temporal dentro de una transacción. Siempre termina con `ROLLBACK`.
