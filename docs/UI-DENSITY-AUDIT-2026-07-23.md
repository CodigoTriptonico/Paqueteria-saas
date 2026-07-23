# Auditoría de densidad visual · 2026-07-23

## Resultado medible

La auditoría determinística `scripts/ui-density-audit.mjs` recorrió 38 páginas y todos los componentes TSX de la aplicación.

| Métrica | Antes | Después | Cambio |
|---|---:|---:|---:|
| Archivos TSX revisados | 213 | 214 | +1 componente compartido |
| Superficies con borde, fondo y radio | 351 | 328 | -23 |
| Superficies anidadas candidatas | 61 | 49 | -12 |
| Explicaciones secundarias candidatas | 63 | 49 | -14 |

Los candidatos restantes no se eliminaron automáticamente. Incluyen controles interactivos, estados vacíos útiles, alertas, tarjetas móviles y superficies operativas independientes que deben conservar su jerarquía.

## Cambios aplicados

- Se creó un solo `CompactInfoDisclosure` accesible para mouse, toque y teclado.
- Se simplificaron superficies anidadas en distribución, comercial, plataforma, configuración, inventario y diálogos de envíos/logística.
- Resúmenes simples ahora usan divisores y espaciado en lugar de tarjetas internas.
- Explicaciones secundarias pasaron a ayuda contextual cerca del campo o título relacionado.
- Labels, errores, límites, importes, bloqueos y consecuencias operativas permanecen visibles.
- Se eliminó el encabezado redundante `Resumen / Inicio`.
- Se corrigió el ancho intrínseco de las acciones colapsadas del inicio a 320 px.
- Se documentó en `UI-STYLE.md` la regla de una superficie principal y sus excepciones.

## Verificación responsive

Se hicieron 96 comprobaciones navegando 12 rutas en cada ancho requerido: 320, 375, 390, 430, 768, 1024, 1280 y 1440 px.

Rutas: inicio, venta, seguimiento, inventario, ingreso a bodega, bodega, logística, contabilidad, estadísticas, configuración, tareas de conductor e inventario de camión.

- Sin scroll horizontal accidental después de la corrección del inicio.
- Las barras de pasos, métricas y filtros que exceden el ancho usan scroll horizontal controlado.
- El panel de ayuda midió 296 px dentro de un viewport de 320 px.
- El activador de ayuda midió 32 × 32 px.
- Escape cerró la ayuda y devolvió el foco al activador.
- El modal de usuario quedó completo dentro de 1440 × 900 px.
- La consola del navegador terminó sin errores.

## Validaciones

- Gate tests: 963/963.
- Evals: 510/510.
- Pruebas específicas de esta limpieza: 22/22.
- Build de producción y TypeScript de Next.js: correcto, 45 rutas generadas.
- ESLint: sin errores ni advertencias.
- Duplicados: dentro del umbral.
- Esquema: 134 migraciones y tablas requeridas válidas.
- Imports de producción: compilación correcta.

`knip` sigue reportando deuda previa de un archivo y exports sin consumidores. No se borraron APIs ajenas a esta tarea para forzar el verificador.
