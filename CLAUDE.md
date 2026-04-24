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

Leaflet 1.9.4 is loaded from unpkg via `<script>`/`<link>` tags in `index.html` with SRI hashes. JSZip 3.10.1 is loaded the same way — it is used only by the KMZ path in the file-drop pipeline. To bump either library, update both the URL and the `integrity` attribute.

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

### Minimap

`setupMinimap(master)` spawns a 180×140 fixed-position overview map in the window's bottom-left corner (hidden on ≤768 px via media query). The master is `mapLeft` — since `linkMaps` keeps both panes in sync we only need to listen to one. It reuses `LEFT_LAYERS[0].build()` (the Yamareco preset) as its basemap so the minimap reads as a miniature of the master pane, and a pink (`#ec4899`, same hue as the GPX track) `L.rectangle` shows the master's current bounds and updates on `move`/`zoom`. The minimap's own zoom tracks `master.getZoom() + MINIMAP_ZOOM_OFFSET` (default −4, clamped to 1–18) so it always reads as an overview. All pan/zoom interactions on the minimap are disabled (`dragging`/`scrollWheelZoom`/`doubleClickZoom`/`touchZoom`/`boxZoom`/`keyboard`/`tap` off) except for a single `click` handler that pans the master to the clicked latlng — giving quick-jump behaviour without accidental pans. Positioned at `z-index: 900`: above Leaflet zoom controls (1000 within each pane's stacking context, but those panes don't stack-context-compete with our fixed container) and below toasts (1000) / drop overlay (2000).

### Track file drag & drop

`setupFileDrop` accepts GPX, KML, KMZ, TCX, and GeoJSON via a full-window drop overlay. `parseDroppedFile` dispatches by file extension (`DROP_SUPPORTED_EXT`). Every parser — `parseGpx` / `parseKml` / `parseKmz` / `parseTcx` / `parseGeoJson` — returns the same normalized shape `{ tracks: [[[lat, lng], ...], ...], waypoints: [{ lat, lng, name }], name }`, so `buildGpxLayer` renders any format with the same pink line + white casing + halo-ed waypoints styling. GeoJSON walks `FeatureCollection` / `Feature` / bare geometry: `Point`/`MultiPoint` → waypoints, `LineString`/`MultiLineString` → tracks, `Polygon`/`MultiPolygon` → outer ring only (holes skipped). KML covers `Point`/`LineString`/`LinearRing`/`MultiGeometry`/`Polygon` plus Google Earth's `gx:Track` (coords are space-separated `"lng lat alt"`, not comma-separated like the standard `<coordinates>` list); `childByLocalName` keeps the lookup namespace-agnostic. KMZ loads via JSZip (`<script>` from unpkg with SRI), prefers `doc.kml`, and falls back to the shortest `*.kml` name in the archive. TCX extracts `<Trackpoint>` positions per `<Track>` and surfaces course metadata via `<CoursePoint>` (summit, junction, etc.) as waypoints. Loaded layers are tracked in `loaded[]` so the header's `✕ クリア` button can remove them from both panes in one call; `fitBounds` runs on the left map only and `linkMaps` syncs the right.

### Search bar (Nominatim)

The header's `<input id="search-input">` queries the OpenStreetMap **Nominatim** geocoder (`nominatim.openstreetmap.org/search`) with `countrycodes=jp&accept-language=ja&format=jsonv2&limit=8`, covering mountain names, stations, place names, huts, bus stops, parking, etc. in one box. `setupSearch` (`src/main.js`) debounces input by 220 ms, memoises responses per query in `SEARCH_CACHE` (a `Map`), and uses a `reqSeq` counter so out-of-order responses are dropped. Incremental suggestions fire during IME composition too — the `input` event isn't guarded, so partial hiragana/katakana queries show results as the user types (Nominatim matches `name:ja` including kana variants). `compositionend` re-schedules with a shorter 60 ms delay so the confirmed kanji triggers a near-instant refresh; if the query is unchanged, `SEARCH_CACHE` serves the result without a fetch. Keyboard navigation: ↑/↓ move through the dropdown (wrapping), Enter selects, Escape closes. Selecting a result calls `mapLeft.setView([lat, lng], zoom)` — the zoom level comes from `classifySearchResult`, which maps each Nominatim `class`/`type` pair (note: `jsonv2` renames `class` → `category`, so the classifier reads `r.class ?? r.category`) to a Japanese badge label (山 / 火山 / 駅 / バス停 / 駐車場 / 山小屋 / キャンプ場 / 市町 / 集落 / 地区 / 島 / 行政区 / 水系 / 展望 ...), a category-specific zoom (peaks → 14, stations → 15, cities → 12, etc.), and a `rank` used by `sortByRank` to reorder results client-side — Nominatim's default `importance`-based ordering otherwise floats station-exit `highway=footway` nodes above the actual `railway=station` for queries like "新宿駅". The right pane follows via `linkMaps`, so only the left map needs `setView`. Nominatim's usage policy (≤1 req/sec, Referer required) is satisfied by the debounce + cache plus the automatic browser Referer — no custom User-Agent header is needed from the page.

### URL hash format

`#lat=<5dp>&lng=<5dp>&z=<int>`. Parsed by `readInitialView`; written by `writeViewToHash`. If no valid hash is present on load, the app falls back to `DEFAULT_VIEW` (鹿島槍ヶ岳 — the "双耳峰" the project is named after) and then attempts `navigator.geolocation.getCurrentPosition`. When the hash **is** present, geolocation is skipped so a shared link lands on the intended view.

### Persisted preferences (localStorage)

`localStorage["souji-maps-prefs"]` stores JSON `{ leftOverlays: string[], rightOverlays: string[], rightBasemap: string }` — lists of overlay display names (the keys used in `L.control.layers`) plus the active right-pane preset name. `readPrefs` / `writePrefs` guard against disabled storage (private mode); `setupPersistentOverlays(map, overlays, defaultsOn, prefsKey)` is the single helper for both panes, wiring the `overlayadd` / `overlayremove` map events. The right-basemap `<select>` change handler calls `writePrefs({ rightBasemap: name })` directly. **Position/zoom is not persisted here** — the URL hash owns that, so sharing a link still wins over a stored preference. Unknown preset names (e.g. a provider removed from `config.js`) fall back to the default without overwriting the saved value, so re-enabling the provider restores the user's choice.

## Conventions

- Code, code comments, and commit messages: English.
- User-facing UI strings (buttons, popups, attribution): Japanese.
- Keep the zero-build property — do not introduce a bundler, package.json, or transpile step without explicit request.
