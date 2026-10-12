# NUBYRA · Familia de iconos 03 (Mujer y balón)

**Propuesta elegida:** tercera de la serie generada; mujer esquemática con balón
dentro del espacio negativo de la V azul y amarilla. Fondo claro (#F9FBFF).

## Inventario
| Archivo | Resoluciones | Uso |
|---|---|---|
| favicon.ico | 16, 24, 32, 48, 64, 128, 256 px | Pestañas y navegadores compatibles |
| favicon.svg | Vector verdadero por trazado, viewBox 1024 | Navegadores modernos |
| favicon-16x16.png | 16 px | Fallback y verificación visual |
| favicon-32x32.png | 32 px | Fallback y accesos rápidos |
| apple-touch-icon.png | 180 px | Accesos de iOS |
| android-chrome-192x192.png | 192 px | Icono Android |
| android-chrome-512x512.png | 512 px | Icono Android de alta densidad |
| maskable-icon-512x512.png | 512 px | Icono adaptable Android |
| site.webmanifest | Archivo JSON | Declaración de iconos y color |
| assets/brand/favicon-03/icon-24.png | 24 px | UI/tamaño intermedio |
| assets/brand/favicon-03/icon-48.png | 48 px | UI/atajos |
| assets/brand/favicon-03/icon-64.png | 64 px | UI |
| assets/brand/favicon-03/icon-96.png | 96 px | UI |
| assets/brand/favicon-03/icon-128.png | 128 px | UI |
| assets/brand/favicon-03/icon-256.png | 256 px | UI |
| assets/brand/favicon-03/original-seleccionado-1024.png | 1024 px | Maestro limpiado para conservar el diseño |

La silueta de la mujer es legible a tamaños medianos/grandes; a 16 px se prioriza
la V de color. El SVG deriva de un trazado fiel a la selección, no del archivo
raster insertado como imagen. Todas las versiones usan el mismo motivo.

## Instalación web
Se sustituyen los archivos de favicon anteriores sin modificar otros recursos,
Google/Supabase Auth ni la landing. Ambas páginas HTML deben referenciar ICO,
SVG, PNG 16/32, Apple Touch Icon y el manifiesto con parámetro de versión para
invalidación de caché.

## Validación
No publicar hasta completar `npm test` y confirmar GitHub Pages `success`.
La sustitución no implica volver a desplegar el bucket Supabase.