import type { OnboardingStepId } from "@/app/actions/onboarding";

export type OnboardingHelpBlock = {
  what: string;
  why: string;
  tip: string;
};

export const onboardingStepHelp: Record<OnboardingStepId, OnboardingHelpBlock> = {
  countries: {
    what: "Los países destino están en Configuración, sección Países y precios.",
    why: "Así Boxario sabe a dónde puede mandar tus cajas.",
    tip: "Menú lateral → Configuración → tarjeta Países y precios → Agregar país.",
  },
  inventory: {
    what: "Aquí creas categorías (carpetas) y los items que vendes: cajas, tamaños o productos.",
    why: "Sin categoría e items no hay nada que poner precio ni vender.",
    tip: "Menú lateral → Inventario → Agregar categoría → + Agregar item.",
  },
  pricing: {
    what: "Los precios se ponen en Configuración → Países y precios, eligiendo cada país.",
    why: "El cliente debe ver el precio correcto antes de pagar.",
    tip: "Abre un país de la lista y asigna precio a cada producto en la tabla.",
  },
  stock: {
    what: "En Inventario abres cada producto y escribes cuántas unidades hay en bodega.",
    why: "Así sabes si te queda mercancía o si ya se acabó.",
    tip: "Si tienes 10 cajas medianas, escribe 10 en esa fila.",
  },
  first_sale: {
    what: "En Nueva venta registras quién envía, quién recibe y cuánto paga.",
    why: "Es la prueba final de que todo quedó bien configurado.",
    tip: "Menú lateral → Nueva venta. Puedes usar datos ficticios para practicar.",
  },
};

export const onboardingGroupHelp: Record<string, OnboardingHelpBlock> = {
  "initial-tasks": {
    what: "Esta lista te guía paso a paso para dejar tu paquetería lista.",
    why: "Cada paso tiene mini-instrucciones según dónde estés en la app.",
    tip: "Empieza por el Paso 1 y sigue el checklist. Puedes volver aquí cuando quieras.",
  },
};
