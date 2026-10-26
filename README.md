# item-box-roulette

Ruleta de escritorio para Windows para decidir al azar entre opciones: qué serie ver, qué peli, a qué jugar… No es una ruleta circular, sino una caja de objetos al estilo de los juegos de carreras: las imágenes pasan muy rápido dentro de un recuadro, van frenando y se paran en una.

- Varias ruletas (Series, Pelis, Juegos…), cada una con sus elementos: nombre + imagen (png, jpg, webp o gif). Sin imagen se muestran sus iniciales.
- El ganador se decide antes de la animación, con la misma probabilidad para todos.
- Se gira con el botón **Girar** o con la **barra espaciadora**. El sonido se puede silenciar.

Hecha con [Tauri 2](https://tauri.app) + Vite + TypeScript.

## Requisitos

- Windows 10 u 11 (WebView2 ya viene con Windows 11).
- [Node.js](https://nodejs.org) 20 o superior.
- [Rust](https://rustup.rs) estable y las herramientas de C++ de Visual Studio ([prerrequisitos de Tauri](https://tauri.app/start/prerequisites/)).

## Ejecutar en desarrollo

```sh
npm install
npm run tauri dev
```

## Compilar el exe

```sh
npm run tauri build
```

- Ejecutable suelto (no necesita instalación): `src-tauri/target/release/item-box-roulette.exe`
- Instalador: `src-tauri/target/release/bundle/nsis/Item Box Roulette_0.1.0_x64-setup.exe`

## Dónde se guardan los datos

En `%APPDATA%\com.itemboxroulette.desktop\`:

- `data.json`: ruletas, elementos, última ruleta activa, panel abierto o cerrado y silencio.
- `images\`: copias de las imágenes elegidas, así que el original se puede mover o borrar.

Para empezar de cero, cierra la app y borra esa carpeta.

## Sonido de giro

Al compilar, la app busca `src/assets/sounds/spin.mp3`. Ese archivo **no está en el repositorio** (está en `.gitignore`):

- Si lo pones, se incluye en el exe y la ruleta se para justo cuando empieza su sonido final, a los 3,48 s (constante `SPIN_SOUND_RESULT_AT` en `src/sound.ts`; ajústala si usas otro audio).
- Si no, la app genera su propio "tic" en cada cambio y una melodía al parar.

## Ideas para más adelante

- Pesos por elemento.
- Sincronización en la nube.
- Varios usuarios.
- Temas.

## Licencia

[MIT](LICENSE)
