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

Side-by-side map viewer: left pane = Yamareco tiles (a 国土地理院-based stack the Japanese hiking site uses), right pane = user-selectable basemap (OpenStreetMap by default). All logic lives in one file, `src/main.js`, driven by `index.html` + `src/style.css`.

### Map synchronization (`linkMaps`)

Both Leaflet maps share a single `syncing` boolean mutex. `move`/`zoom` events on either map call `setView` on the other with `{ animate: false, noMoveStart: true }`; the mutex blocks the echo event from the programmatic `setView` so we don't get an infinite loop. The same handler writes lat/lng/zoom into `window.location.hash` (via `history.replaceState`) and updates the header status display — so the URL always reflects the current view and sharing it re-opens the exact same location.

### Tile layer presets

`LEFT_LAYERS` and `RIGHT_LAYERS` are arrays at the top of `main.js`. Left entries are `{ name, build }`; right entries also carry `linkHref` / `linkText` so the right pane header's external link + `aria-label` can be updated whenever the user switches basemaps, plus a `group` label that drives `<optgroup>` rendering in the header `<select>` and an optional `requires` field that gates API-key-only providers. `LEFT_LAYERS` currently uses only index `0`; `RIGHT_LAYERS` defines up to 32 presets across 6 groups, any of which may be hidden if their API key is missing: **標準地図** (OSM, OSM Humanitarian, CARTO Voyager, Esri ストリート), **淡色・ダーク** (CARTO Positron/Dark Matter, Esri グレーキャンバス, Stadia Alidade Smooth Dark *(key)*, Stamen Toner *(key)*), **Google Maps** (道路/地形/航空写真/ハイブリッド), **地理院 (日本)** (標準/淡色/白地図/色別標高図), **地形・アウトドア** (OpenTopoMap, Esri 地形図, Esri ナショジオ, CyclOSM, Esri 海洋, Stadia Outdoors *(key)*, Stamen Terrain *(key)*, Thunderforest Outdoors/Landscape *(key)*, MapTiler Outdoor/Winter *(key)*, Mapbox Outdoors *(key)*), and **衛星・空中写真** (地理院 空中写真, Esri 衛星写真, Mapbox 衛星ストリート *(key)*). `(key)` marks entries gated by `requires`.

**Ordering constraint**: `populateRightBasemapSelect` emits an `<optgroup>` whenever `preset.group` changes between consecutive entries — so presets sharing a group must stay contiguous in `RIGHT_LAYERS`, otherwise the same label would render twice. Group order in the menu is simply the order groups first appear in the array.

**API keys & `src/config.js`**: optional basemap providers (Thunderforest, MapTiler, Mapbox, Stadia/Stamen) read their keys from `window.SOUJI_MAPS_KEYS`, populated by `src/config.js` — loaded via a non-deferred `<script>` tag in `index.html` *before* `main.js` so the global is set by the time presets are built. Runtime overrides from `localStorage["souji-maps-keys"]` (JSON) win over the file so users can keep keys out of git. Each keyed preset declares `requires: KEYS.<provider>` (truthy string / boolean); `isPresetEnabled` + `buildRightBasemaps()` drop them when falsy, so the dropdown stays clean. Stadia uses domain-authenticated access — no `api_key=` in the URL, just flip `stadia.enabled: true` after registering the site at `client.stadiamaps.com`. The other three embed `apikey=` / `key=` / `access_token=` in the URL; if committing to a public repo, lock the key by HTTP Referer in the provider dashboard.

`buildGoogleTileLayer(lyrs)` (`m`=道路, `s`=航空, `y`=ハイブリッド, `p`=地形) and `buildEsriTileLayer(service, { maxNativeZoom, source })` are shared factories — service names come from the `server.arcgisonline.com/ArcGIS/rest/services/<service>/MapServer` path, and each Esri service has its own attribution "source" string plus (for some) a lower `maxNativeZoom` than Leaflet's default.

**Google tiles caveat**: the Google entries hit the internal `mt{0-3}.google.com/vt/` endpoint, which is *not* the officially sanctioned embed path — Google's Maps Platform ToS expects the Maps JavaScript API. They're included because this is a personal/non-commercial viewer; remove them if that changes.

The right pane's basemap is switched **via a `<select class="pane-title-select">` inside the pane header** (the `.pane-title` itself is the `<select>`), not via `L.control.layers`. `buildRightBasemaps()` returns `[{ preset, layer }, ...]`; `populateRightBasemapSelect` fills the `<select>` with an `<option>` per preset. The `change` handler removes the active basemap layer and adds the newly selected one, then calls `applyRightPaneHeader` to update link/aria. Overlay layers (Waymarked Trails, hillshade) are unaffected because they are separate layers registered with `L.control.layers`. Because the default basemap is added by the init sequence (not `createMap`), `createMap` is called with `{ addDefault: false }` for the right pane to avoid double-adding.

Overlays are added per side and managed with `L.control.layers`:

- **Left (Yamareco)**: みんなの足跡 (5 type variants: 夏期/冬期/沢・岩/スキー/すべて), 登山道 (GeoJSON), 山頂・山小屋・登山口など (GeoJSON). Default ON: 夏期 足跡 + 登山道 + ポイント.
- **Right**: Waymarked Trails (hiking), 地理院陰影起伏図. Both ON by default. These overlays persist across basemap switches because they are registered with the control as overlays, not base layers.

### `GeoJsonTileLayer` (custom Leaflet extension)

`main.js:157` defines an `L.TileLayer` subclass that fetches **GeoJSON per tile** from Yamareco's `socket.yamareco.com/v2/course/*` endpoints (same scheme as Yamareco's `rakuroute.js`). For each tile it `fetch`es the GeoJSON, creates a child `L.geoJSON` layer per feature, and tracks them in `_tileFeatures: Map<tileKey, subLayers[]>` so `_removeTile` can clean up when the tile leaves the viewport. This is the mechanism behind the 登山道 and point overlays. `minNativeZoom`/`maxNativeZoom` are pinned to 12 so Leaflet only requests tiles at that level and scales visually at other zooms.

`COURSE_STYLES` maps Yamareco's numeric `type` field to color/dash styling (一般 / 難路 / バリエーション / 沢 / 冬道 / 林道 / リフト). `POINT_DESIGNS` maps point types to Yamareco's own icon PNGs loaded from `www.yamareco.com/modules/yr_plan/images/rakuroute/`. Point popups are built manually with `escapeHtml` — preserve this when editing.

### Hillshade blend (right pane)

The GSI 陰影起伏図 is attached to a **custom Leaflet pane** (`hillshadePane`, z-index 250 between tilePane 200 and overlayPane 400) with `mix-blend-mode: soft-light` and `filter: contrast(1.2)`. `soft-light` was chosen deliberately over `multiply` because `multiply` darkens the whole map; `soft-light` boosts relief contrast without killing brightness. If you change the blend mode, re-tune `contrast()` accordingly.

### URL hash format

`#lat=<5dp>&lng=<5dp>&z=<int>`. Parsed by `readInitialView`; written by `writeViewToHash`. If no valid hash is present on load, the app falls back to `DEFAULT_VIEW` (鹿島槍ヶ岳 — the "双耳峰" the project is named after) and then attempts `navigator.geolocation.getCurrentPosition`. When the hash **is** present, geolocation is skipped so a shared link lands on the intended view.

### Persisted preferences (localStorage)

`localStorage["souji-maps-prefs"]` stores JSON `{ leftOverlays: string[], rightOverlays: string[], rightBasemap: string }` — lists of overlay display names (the keys used in `L.control.layers`) plus the active right-pane preset name. `readPrefs` / `writePrefs` guard against disabled storage (private mode); `setupPersistentOverlays(map, overlays, defaultsOn, prefsKey)` is the single helper for both panes, wiring the `overlayadd` / `overlayremove` map events. The right-basemap `<select>` change handler calls `writePrefs({ rightBasemap: name })` directly. **Position/zoom is not persisted here** — the URL hash owns that, so sharing a link still wins over a stored preference. Unknown preset names (e.g. a provider removed from `config.js`) fall back to the default without overwriting the saved value, so re-enabling the provider restores the user's choice.

## Conventions

- Code, code comments, and commit messages: English.
- User-facing UI strings (buttons, popups, attribution): Japanese.
- Keep the zero-build property — do not introduce a bundler, package.json, or transpile step without explicit request.
