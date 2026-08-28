# MiniTube Player 🎵

App de escritorio para Windows hecha con **React + Tauri** que busca y reproduce
música de YouTube por categoría (Reguetón, Romántico, Bachata, Favoritos) o por
texto libre, con controles propios (play/pause, anterior, siguiente, barra de
progreso, volumen), sin necesidad de abrir el navegador.

## Comportamiento de ventanas (v1.2)

- **Al abrir**: aparece la ventana **compacta/cuadrada** (diseño de la izquierda
  de la foto de referencia): categorías, lista de reproducción y barra inferior
  de controles.
- **Al arrastrar y acoplar al borde derecho** de la pantalla: cambia
  automáticamente al **modo lateral compacto** (diseño de la derecha de la
  foto): carátula grande, controles centrados y lista de "Siguientes".
- **Auto-ocultar**: si está activado, al sacar el mouse la ventana se esconde
  como una franja de color en el borde. Pasá el mouse por ahí para recuperarla.

## Qué cambió en versiones recientes

- **Se arregló el bug de "solo 2 canciones"**. Ahora un comando de Rust
  (`buscar_youtube`) trae la lista **completa** de resultados reales de YouTube
  antes de reproducir nada. Cada categoría combina 2 búsquedas en vivo.
- **Buscador real**: escribí cualquier término y trae resultados de YouTube.
- **Diseño dual**: modo normal (lista + mini player) y modo lateral (al acoplar).
- Botón de maximizar en la barra de título.

## Cómo funciona la búsqueda (sin API key)

El backend de Rust pide la página de resultados de YouTube y lee los datos
incluidos (sin YouTube Data API ni API key). El reproductor de YouTube (oculto)
solo se usa para reproducir cada video.

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

## Compilar el instalador de Windows

```bash
npm run tauri build
```

El instalador queda en: `src-tauri/target/release/bundle/`

## Compilar automáticamente en GitHub

Este repo incluye `.github/workflows/build.yml`. Al subirlo a GitHub el workflow
corre en cada push a `main` o manualmente. Con un tag `v1.2.0` publica un draft
release con el instalador.
