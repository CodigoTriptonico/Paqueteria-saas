# Módulo Agencias

Agencias es una capacidad opcional del contrato de cada matriz de Boxario.

- `organizations.settings.agencies_enabled` es la fuente de verdad. Ausente o `false` significa bloqueado.
- Solo un administrador de plataforma puede cambiarla desde la ficha de la empresa en `/platform`.
- Las empresas nuevas se crean con el módulo desactivado.
- Al desactivarlo se ocultan la navegación, las opciones operativas, los roles, los textos compartidos y los datos históricos vinculados a agencias. Las rutas directas, acciones del servidor y permisos de base de datos también se bloquean.
- Desactivar el módulo no borra agencias ni historial. Al reactivarlo, la operación existente vuelve a estar disponible.
- La matriz no ve el nombre ni el estado del módulo mientras está desactivado. Solo Boxario lo administra desde `/platform`.

La configuración general de la matriz está reunida en `Configuración > Organización`, con las pestañas Empresa, Plan, Usuarios y Bodegas.
