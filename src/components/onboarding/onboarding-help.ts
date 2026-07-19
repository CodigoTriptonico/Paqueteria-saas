import type { OnboardingStepId } from "@/app/actions/onboarding";

export type OnboardingHelpBlock = {
  what: string;
  why: string;
  tip: string;
};

export const onboardingStepHelp: Record<OnboardingStepId, OnboardingHelpBlock> = {
  countries: {
    what: "Los países destino están en Configuración → Países y precios.",
    why: "Boxario necesita saber a qué países puedes enviar antes de cotizar o vender.",
    tip: "Menú lateral → Configuración → Países y precios → Agregar país o elige uno de la lista.",
  },
  inventory: {
    what: "En Inventario creas categorías y productos: cajas, tamaños o artículos que vendes.",
    why: "Sin productos en el catálogo no hay nada que asignar a un país ni cobrar en venta.",
    tip: "Inventario → icono de estructura → Nueva categoría → elige la categoría → Agregar.",
  },
  pricing: {
    what: "En Países y precios eliges un destino, vinculas productos y pones su precio de venta.",
    why: "El cliente debe ver el precio correcto según el país del destinatario.",
    tip: "Abre un país → pestaña Items → + Agregar ítems (si faltan) → escribe precio de venta.",
  },
  stock: {
    what: "En Inventario abres cada producto y registras cuántas unidades hay en bodega.",
    why: "Así sabes si te queda mercancía disponible al vender.",
    tip: "Inventario → abre un producto → escribe el stock actual (ej. 10 cajas medianas).",
  },
  first_sale: {
    what: "En Nueva venta registras remitente, destinatario, producto y cobro.",
    why: "Es la prueba final de que países, productos, precios y stock quedaron bien.",
    tip: "Nueva venta → remitente → destinatario (con país) → producto → cobrar. Puedes usar datos de prueba.",
  },
};

export const onboardingGroupHelp: Record<string, OnboardingHelpBlock> = {
  "initial-tasks": {
    what: "Esta lista te guía paso a paso para dejar tu paquetería lista para vender.",
    why: "Cada paso tiene mini-instrucciones según la pantalla en la que estés.",
    tip: "Abre Notificaciones (campana) y sigue del Paso 1 al 5. También puedes empezar en Nueva venta y la app te irá guiando.",
  },
};
