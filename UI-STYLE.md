# Criterio de UI — Boxario

Documento de **gusto y decisiones**, no un manual de clases. Si algo aquí choca con el código existente, mira primero cómo ya lo resolvimos en pantallas que funcionan (`/inventario`, inicio, venta) y extiende ese criterio.

**En una frase:** interfaz oscura, operativa, densa pero estable — hecha para quien trabaja horas en mostrador o backoffice, no para impresionar en un dribbble.

---

## Qué buscamos (intangible)

- **Calma visual.** Nada debe “saltar”, “empujar” o “cortarse” al interactuar. Si abres un filtro, un menú o un buscador, el resto de la pantalla se queda quieto.
- **Un solo lugar para cada cosa.** Si ya elegiste la bodega o la categoría arriba, no repitas ese contexto en un título grande abajo. Confía en que el usuario sabe dónde miró.
- **Lo principal ocupa el espacio.** Inventario = ver y tocar items. Historial, estructura y ajustes finos son secundarios: accesibles, pero no compiten con la grilla.
- **Feedback claro, sin ruido.** Estados (stock ok/bajo/vacío) se entienden de un vistazo por color y tono de fondo, no por marcos chillones. Confirmaciones breves cuando haces algo (agregar item, movimiento).
- **Coherencia operativa.** Misma lógica en toda la app: buscar = escribir donde está el valor; elegir = abrir ahí mismo; lo extra = flotante o lateral, nunca una franja nueva que robe altura.

---

## Sensibilidad estética

| Sí | No |
|----|-----|
| Verde-gris profundo, capas sutiles de superficie | Blanco puro, grises planos tipo SaaS genérico |
| Esmeralda para acción y foco | Arcoíris de acentos sin significado |
| Bordes negros discretos como separadores | Bordes de color en contenedores grandes |
| Tipografía bold/black, legible a distancia | Texto fino, gris sobre gris, labels decorativos |
| Iconos compactos en barra de herramientas | Botones que cambian de ancho al abrir o en breakpoints |
| Números grandes en métricas; etiquetas completas que no se parten | Abreviaturas rotas (“RE SERVADO”), tablas apretadas |

El acento esmeralda es **confianza y acción**. Ámbar y rosa son **alerta operativa** (bajo / vacío), no decoración.

---

## Patrón oficial: superficie operativa oscura

Este es el estilo por defecto para toda pantalla nueva de administración, configuración, empresas, equipos o detalle de un registro. La referencia implementada está en `platform-console.tsx`.

- **Una sola cabecera por vista.** Fondo `bg-surface-card`, borde negro, sombra negra suave y radio `rounded-xl`. La navegación atrás, estado y menú de opciones viven dentro de esa misma cabecera. Nunca repetir el nombre del registro en el `Panel` y otra barra debajo.
- **Cabecera informativa, no promocional.** Icono compacto sobre `bg-surface-inset`, etiqueta en esmeralda, título claro y una sola frase que explique qué se controla. No usar franjas turquesa, cyan, azul o gradientes brillantes como fondo de páginas o listas.
- **Acción contenida.** Solo la acción primaria puede usar el esmeralda estándar (`primaryButtonClass`). Estados usan su tono semántico en una cápsula pequeña. El resto de controles son oscuros (`bg-surface-inset`) con borde negro.
- **Métricas y datos como tarjetas operativas.** `bg-surface-card`, borde negro, radio `rounded-xl` y sombra negra muy leve. Etiqueta corta arriba, dato legible debajo, ayuda en gris. No tarjetas blancas, fondos de color completo ni decoraciones para rellenar.
- **Detalles con capas, no más colores.** Para campos secundarios, separar con `border-black` y usar `bg-surface-inset/40`; no crear otra paleta. Un bloque de identidad puede ser ancho y el contexto secundario puede ir al lado, pero ambos conservan la misma superficie.
- **Iconos antes que emojis decorativos.** Usar `lucide-react` para identidad, personas, bodegas y acciones. Los emojis solo se permiten si comunican un estado que ya se reconoce en el producto.

En síntesis: fondo verde-gris oscuro, bordes negros discretos, texto blanco/gris legible y esmeralda solo para foco, acción o estado sano.

---

## Cómo pensar pantallas de trabajo (ej. inventario)

1. **Barra superior = contexto y filtros.** Bodega, categoría, búsqueda. Todo lo que define *qué estás viendo*.
2. **Esquina derecha = herramientas.** Historial, estructura, configuración puntual. Iconos del mismo peso; nombre completo en tooltip o panel al abrir.
3. **Centro = trabajo.** Listas, tarjetas, stock. Scroll aquí, no en toda la página si se puede evitar.
4. **Secundario = overlay.** Drawer lateral para historial; popover anclado para crear categoría/item. Nunca un acordeón bajo la barra que empuje la lista.

Al **agregar un item**, respeta lo que el usuario ya tiene seleccionado en los filtros. No le pidas de nuevo lo obvio; si falta contexto, dilo y bloquea.

---

## Patrones de interacción (nombre interno)

- **Combobox buscable inline:** el control *es* el buscador. Cerrado muestra la elección; abierto escribes en el mismo sitio; resultados flotan debajo.
- **Toolbar estable:** altura fija, sin anillos que “engorden” el control, sin labels que aparezcan y desaparezcan.
- **Tarjeta de stock:** el estado tiñe toda la tarjeta con calma; el borde exterior sigue neutro; dentro, métricas con divisiones visibles (líneas que se noten).
- **Historial aparte:** consulta, no decoración. No va al pie de la pantalla ni en una franja que repita títulos.
- **Menú lateral por capas:** el encabezado indica qué grupo está abierto; el enlace hijo usa fondo y punto esmeralda para indicar la página actual. Los iconos de herramientas describen la acción, nunca una dirección que la interfaz no respeta. No usar numeración decorativa en enlaces que no sean una secuencia obligatoria.

---

## Antes de entregar UI, pregúntate

1. ¿Algo se movió cuando abrí un menú o un buscador? → Mal; flotante o drawer.
2. ¿Repito información que ya está en un selector? → Quitar el repetido.
3. ¿Una acción poco frecuente ocupa espacio permanente grande? → Icono + overlay.
4. ¿El usuario sabe dónde quedó lo que acaba de crear? → Debe verse en la lista filtrada actual, con confirmación breve.
5. ¿Parece plantilla Bootstrap/shadcn genérico? → Acercarlo a lo que ya hay en Boxario (oscuro, bordes negros, esmeralda contenido).

---

## Lo que nos frustra (aprendido en producto)

- Páginas cortadas abajo o paneles más altos que la ventana.
- Historial o extras pegados al contenido principal.
- Buscadores en un sitio distinto al valor seleccionado.
- Tarjetas que cambian de tamaño al enfocar.
- Títulos duplicados (“Cajas” arriba y otra vez “Cajas · 1 item”).
- Crear algo en una categoría distinta a la que se está mirando.

---

## Implementación (referencia, no reglas)

Los detalles viven en el código y evolucionan:

- Tokens y superficies: `globals.css`
- Piezas reutilizables: `ui-blocks.tsx`, `inline-search-picker.tsx`, `inventory-stock.ts`
- Inventario como referencia de pantalla densa: `inventory-structure-editor.tsx`, `inventario-client.tsx`

**Regla para agentes y contribuidores:** lee este doc para *decidir*; lee el código existente para *implementar*. Si inventas un patrón nuevo, debe sentirse como las pantallas que ya aprobamos, no como un design system distinto.
