import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/conductor/tareas",
    name: "Boxario Conductores",
    short_name: "Boxario",
    description: "Entregas, recogidas y evidencia de ruta",
    start_url: "/conductor/tareas",
    scope: "/",
    display: "standalone",
    background_color: "#101713",
    theme_color: "#152019",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
