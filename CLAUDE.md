# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Maintaining this file

Treat this document as a living map of the project, not a snapshot. When a change you make would invalidate or extend anything described here — the architecture, file layout, conventions, default overlays, URL hash format, build/deploy story, etc. — update CLAUDE.md in the same commit. If a new concept needs explaining (a new helper module, a new data source, a non-obvious workaround), add a section for it. Conversely, delete sections that no longer reflect the code. The aim is that a future session can rely on this file without cross-checking every claim.

## Running locally

There is no build step, package manager, or test suite. Serve the static files over HTTP (not `file://`, since `tile.openstreetmap.org` rejects requests without a Referer):

```sh
./serve.sh          # → http://127.0.0.1:5173/
./serve.sh 8080     # custom port
```

The site is published to GitHub Pages at https://yakkun.github.io/SoujiMaps/ directly from the `main` branch — any commit to `main` goes live, so there is no staging environment.

Leaflet 1.9.4 is loaded from unpkg via `<script>`/`<link>` tags in `index.html` with SRI hashes. To bump Leaflet, update both the URL and the `integrity` attribute.

## Architecture

Side-by-side map viewer: left pane = Yamareco tiles (a 国土地理院-based stack the Japanese hiking site uses), right pane = OpenStreetMap standard tiles. All logic lives in one file, `src/main.js`, driven by `index.html` + `src/style.css`.

### Map synchronization (`linkMaps`)

Both Leaflet maps share a single `syncing` boolean mutex. `move`/`zoom` events on either map call `setView` on the other with `{ animate: false, noMoveStart: true }`; the mutex blocks the echo event from the programmatic `setView` so we don't get an infinite loop. The same handler writes lat/lng/zoom into `window.location.hash` (via `history.replaceState`) and updates the header status display — so the URL always reflects the current view and sharing it re-opens the exact same location.

### Tile layer presets

`LEFT_LAYERS` and `RIGHT_LAYERS` are arrays of `{ name, build }` objects at the top of `main.js`. Only index `0` is currently used, but the shape is preserved so alternate basemaps can be slotted in later. This is the place to edit when swapping tile sources.

Overlays are added per side and managed with `L.control.layers`:

- **Left (Yamareco)**: みんなの足跡 (5 type variants: 夏期/冬期/沢・岩/スキー/すべて), 登山道 (GeoJSON), 山頂・山小屋・登山口など (GeoJSON). Default ON: 夏期 足跡 + 登山道 + ポイント.
- **Right (OSM)**: Waymarked Trails (hiking), 地理院陰影起伏図. Both ON by default.

### `GeoJsonTileLayer` (custom Leaflet extension)

`main.js:157` defines an `L.TileLayer` subclass that fetches **GeoJSON per tile** from Yamareco's `socket.yamareco.com/v2/course/*` endpoints (same scheme as Yamareco's `rakuroute.js`). For each tile it `fetch`es the GeoJSON, creates a child `L.geoJSON` layer per feature, and tracks them in `_tileFeatures: Map<tileKey, subLayers[]>` so `_removeTile` can clean up when the tile leaves the viewport. This is the mechanism behind the 登山道 and point overlays. `minNativeZoom`/`maxNativeZoom` are pinned to 12 so Leaflet only requests tiles at that level and scales visually at other zooms.

`COURSE_STYLES` maps Yamareco's numeric `type` field to color/dash styling (一般 / 難路 / バリエーション / 沢 / 冬道 / 林道 / リフト). `POINT_DESIGNS` maps point types to Yamareco's own icon PNGs loaded from `www.yamareco.com/modules/yr_plan/images/rakuroute/`. Point popups are built manually with `escapeHtml` — preserve this when editing.

### Hillshade blend (right pane)

The GSI 陰影起伏図 is attached to a **custom Leaflet pane** (`hillshadePane`, z-index 250 between tilePane 200 and overlayPane 400) with `mix-blend-mode: soft-light` and `filter: contrast(1.2)`. `soft-light` was chosen deliberately over `multiply` because `multiply` darkens the whole map; `soft-light` boosts relief contrast without killing brightness. If you change the blend mode, re-tune `contrast()` accordingly.

### URL hash format

`#lat=<5dp>&lng=<5dp>&z=<int>`. Parsed by `readInitialView`; written by `writeViewToHash`. If no valid hash is present on load, the app falls back to `DEFAULT_VIEW` (鹿島槍ヶ岳 — the "双耳峰" the project is named after) and then attempts `navigator.geolocation.getCurrentPosition`. When the hash **is** present, geolocation is skipped so a shared link lands on the intended view.

## Conventions

- Code, code comments, and commit messages: English.
- User-facing UI strings (buttons, popups, attribution): Japanese.
- Keep the zero-build property — do not introduce a bundler, package.json, or transpile step without explicit request.
