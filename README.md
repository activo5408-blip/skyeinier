# MiniTube Player 🎵

App de escritorio para Windows hecha con **React + Tauri** que busca y reproduce
música de YouTube por categoría (Reguetón, Romántico, Bachata, Favoritos) o por
texto libre, con controles propios (play/pause, anterior, siguiente, barra de
progreso, volumen), sin necesidad de abrir el navegador.

## Qué cambió en esta versión

- **Se arregló el bug de "solo 2 canciones"**. Antes la app dependía de la
  lista interna del reproductor de YouTube (`getPlaylist()`), que a veces se
  leía a medio cargar. Ahora un comando de Rust (`buscar_youtube`) trae la
  lista **completa** de resultados reales (título, canal, duración y
  miniatura de cada video) directamente de YouTube antes de reproducir nada,
  y el reproductor solo se usa para pasar de un video a otro. Cada categoría
  combina 2 búsquedas en vivo, así que normalmente carga entre 30 y 80
  minutos de música (muy por arriba de los 30 minutos pedidos) y siempre es
  contenido actual, porque es una búsqueda en tiempo real, no una lista fija
  guardada de antemano.
- **Buscador real**, igual que en la imagen de referencia: se puede escribir
  cualquier término (`payaso por ley`, un artista, etc.) y trae resultados
  reales de YouTube con miniatura, título, canal y duración.
- **Diseño nuevo** en pantalla ancha (estilo "MiniTube Player"): categorías en
  pastillas con degradé, panel de resultados a la izquierda, panel de
  "reproduciendo ahora" con carátula grande y barra de progreso tipo onda de
  audio a la derecha, controles grandes abajo.
- **Auto-ocultar en el borde del monitor**: al sacar el mouse de la ventana
  unos segundos, la app se esconde como una franja de color en el borde
  derecho de la pantalla, y al pasar el mouse por ahí vuelve a aparecer con
  el diseño completo. Se puede activar/desactivar desde el engranaje
  "Ajustes" (abajo a la derecha).
- Botón de maximizar agregado en la barra de título, junto a minimizar y
  cerrar.

## Cómo funciona la búsqueda (sin API key)

La YouTube IFrame Player API dejó de admitir `listType: "search"`, así que la
búsqueda y la carga de categorías las hace el backend de Rust: pide la misma
página que abrirías en `youtube.com/results?search_query=...` y lee los datos
que YouTube ya manda incluidos en esa página (sin usar la YouTube Data API ni
necesitar una API key). El reproductor de YouTube (oculto, 0x0) solo se usa
después para efectivamente reproducir cada video elegido.

Como esto depende del formato HTML actual de YouTube, si en el futuro YouTube
cambia ese formato drásticamente, la búsqueda podría dejar de traer
resultados hasta actualizar el código; el mensaje de error en pantalla
("YouTube no devolvió resultados...") avisaría de eso.

"Favoritos" sigue guardando localmente (en el dispositivo) los videos que
agregues con el botón ⭐ mientras suenan.

## Requisitos para compilar en tu PC

- [Node.js 20+](https://nodejs.org)
- [Rust](https://www.rust-lang.org/tools/install)
- En Windows: "Desktop development with C++" (Build Tools de Visual Studio).

## Manera más fácil: doble clic

Ejecutá `instalar-y-compilar.bat` y elegí la opción 2 para generar el
instalador de Windows (`.msi` / `.exe`), que va a quedar en
`src-tauri\target\release\bundle\`.

## Desarrollo local

```bash
npm install
npm run tauri dev
```

## Compilar el instalador de Windows manualmente

```bash
npm run tauri build
```

El instalador (`.msi` y `.exe` de NSIS) queda en:
`src-tauri/target/release/bundle/`

## Compilar automáticamente en GitHub (sin instalar nada)

Este repo ya incluye `.github/workflows/build.yml`. Al subirlo a GitHub:

1. Creá un repositorio nuevo y subí esta carpeta completa.
2. Andá a la pestaña **Actions** del repo: el workflow corre solo en cada
   push a `main`, o manualmente con el botón "Run workflow".
3. Para publicar una release con el instalador adjunto, creá un tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
   El workflow sube el `.msi`/`.exe` como *draft release* en GitHub, listo
   para descargar.

## Estructura del proyecto

```
├── src/                  # Frontend React
│   ├── App.jsx           # UI + lógica del reproductor
│   └── App.css           # Estilos (diseño tipo MiniTube Player)
├── src-tauri/             # Backend Rust / config nativa de Windows
│   ├── src/main.rs        # Ventana + comando buscar_youtube (scraping)
│   ├── tauri.conf.json    # tamaño de ventana, íconos, targets (nsis/msi)
│   └── capabilities/      # permisos de la ventana (incluye mover/redimensionar
│                           # para el auto-ocultado en el borde)
└── .github/workflows/     # compilación automática para Windows
```

## Notas

- La ventana es **sin bordes nativos** (`decorations: false`), con una
  barra de título propia (minimizar / maximizar / cerrar).
- El uso de contenido de YouTube dentro de la app debe respetar los
  [Términos de Servicio de YouTube](https://www.youtube.com/t/terms);
  esta app no descarga ni redistribuye video, solo lo reproduce embebido
  igual que cualquier página web con un video de YouTube incrustado.
