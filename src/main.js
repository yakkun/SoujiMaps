// Souji Maps — main module
// Left pane:  Yamareco public tile server (yamatile.com, same endpoint the
//             yamareco.com map viewer uses).
// Right pane: OpenStreetMap standard tiles.

/* global L */

const DEFAULT_VIEW = {
  // 双耳峰として有名な鹿島槍ヶ岳付近を初期位置にする
  lat: 36.6178,
  lng: 137.7472,
  zoom: 13,
};

const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

const YAMARECO_ATTR =
  '地図: <a href="https://www.yamareco.com/" target="_blank" rel="noreferrer">ヤマレコ</a> (<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>タイル)';
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

const LEFT_LAYERS = [
  {
    name: "ヤマレコ 標準",
    build: () =>
      L.tileLayer("https://{s}.yamatile.com/std/{z}/{x}/{y}.png", {
        subdomains: ["a", "b", "c"],
        maxZoom: MAX_ZOOM,
        attribution: YAMARECO_ATTR,
      }),
  },
];

const FOOTPRINT_ATTR =
  '足跡: <a href="https://www.yamareco.com/" target="_blank" rel="noreferrer">ヤマレコ</a>';

// Yamareco「みんなの足跡」オーバーレイ。type 毎に独立したタイルレイヤーを作る。
function buildFootprintLayer(type) {
  const isAll = type === "all";
  return L.tileLayer(
    `https://yamareco.info/modules/yamareco/include/get_tileimg.php?type=${type}&z={z}&y={y}&x={x}`,
    {
      attribution: FOOTPRINT_ATTR,
      opacity: isAll ? 0.5 : 0.7,
      minNativeZoom: 5,
      maxNativeZoom: isAll ? 15 : 16,
      maxZoom: MAX_ZOOM,
      zIndex: 100,
    },
  );
}

const FOOTPRINT_TYPES = {
  夏期: "dot_summer",
  冬期: "dot_winter",
  "沢・岩": "dot_climb",
  スキー: "dot_ski",
  すべて: "all",
};

// ── ヤマレコの登山道 / 地点 GeoJSON オーバーレイ ──
// rakuroute (https://www.yamareco.com/modules/yr_plan/step1_rakuroute.php)
// で使われているエンドポイントを参考にしている。
const YAMA_API = "https://socket.yamareco.com/v2";
const YAMA_ATTR = '&copy; <a href="https://www.yamareco.com/" target="_blank" rel="noreferrer">Yamareco</a>';
const YAMA_ICON_BASE =
  "https://www.yamareco.com/modules/yr_plan/images/rakuroute";

// 登山道の type 別スタイル (rakuroute.js の course_type_styles を踏襲)
const COURSE_STYLES = {
  "-1": { color: "#0000BB", opacity: 1, weight: 3 }, // リフト
  0: { color: "#990066", opacity: 1, weight: 3 }, // 一般
  1: { color: "#990066", opacity: 1, weight: 3 }, // 林道・作業道
  2: { color: "#990066", opacity: 1, weight: 5, dashArray: "10" }, // 難路
  3: { color: "#CC0000", opacity: 1, weight: 5, dashArray: "10,10,3,10" }, // バリエーション
  4: { color: "#0000CC", opacity: 1, weight: 5, dashArray: "10,10,3,10" }, // 沢
  5: { color: "#0000FF", opacity: 1, weight: 5, dashArray: "10" }, // 冬道
};
const courseStyle = (feature) =>
  COURSE_STYLES[Number(feature.properties?.type)] || COURSE_STYLES[0];

const makeIcon = (name) =>
  L.icon({
    iconUrl: `${YAMA_ICON_BASE}/${name}.png`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });

const POINT_DESIGNS = {
  2: { label: "山小屋(通年)", icon: makeIcon("icon_hut02") },
  3: { label: "駐車場", icon: makeIcon("icon_parking") },
  4: { label: "山小屋(期間営業)", icon: makeIcon("icon_hut01") },
  5: { label: "避難小屋", icon: makeIcon("icon_hut03") },
  6: { label: "山頂", icon: makeIcon("icon_peak") },
  7: { label: "登山口", icon: makeIcon("icon_entrance") },
  10: { label: "トイレ", icon: makeIcon("icon_toilet") },
  13: { label: "危険箇所", icon: makeIcon("icon_danger") },
  15: { label: "水場", icon: makeIcon("icon_water") },
  16: { label: "ゲート", icon: makeIcon("icon_gate") },
  17: { label: "バス停", icon: makeIcon("icon_busstop") },
  18: { label: "キャンプ場/テント場", icon: makeIcon("icon_tent") },
  19: { label: "展望", icon: makeIcon("icon_view") },
  20: { label: "花", icon: makeIcon("icon_flower") },
  21: { label: "ホテル・旅館", icon: makeIcon("icon_hotel") },
  22: { label: "温泉", icon: makeIcon("icon_spa") },
  23: { label: "小屋", icon: makeIcon("icon_hut04") },
  98: { label: "立入禁止", icon: makeIcon("icon_prohibit") },
  99: { label: "その他", icon: makeIcon("icon_info") },
};

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function pointToLayer(feature, latlng) {
  const type = Number(feature.properties?.type);
  const design = POINT_DESIGNS[type];
  if (!design) {
    // type=1 (経由ポイント) 等は小さな円で表示
    return L.circleMarker(latlng, {
      radius: 2,
      color: "#990066",
      weight: 1,
      fillColor: "#990066",
      fillOpacity: 1,
    });
  }
  return L.marker(latlng, { icon: design.icon, title: feature.properties?.name });
}

function onEachPointFeature(feature, layer) {
  const props = feature.properties || {};
  const type = Number(props.type);
  const design = POINT_DESIGNS[type];
  if (!design) return;
  const name = props.name || design.label;
  const alt = Number(props.altitude);
  const lines = [`<strong>${escapeHtml(name)}</strong>`];
  if (name !== design.label) lines.push(`<small>${escapeHtml(design.label)}</small>`);
  if (alt > 0) lines.push(`<small>${alt.toFixed(1)} m</small>`);
  if (props.point_id) {
    lines.push(
      `<a href="https://www.yamareco.com/modules/yamainfo/ptinfo.php?ptid=${encodeURIComponent(props.point_id)}" target="_blank" rel="noreferrer">ヤマレコで見る ↗</a>`,
    );
  }
  layer.bindPopup(lines.join("<br>"), { autoPan: false });
}

// タイル単位で GeoJSON を取得して地図に描画する TileLayer 拡張。
// Yamareco の rakuroute.js の TileLayer.GeoJSON と同じ仕組み。
const GeoJsonTileLayer = L.TileLayer.extend({
  initialize(urlTemplate, options) {
    L.TileLayer.prototype.initialize.call(this, urlTemplate, options);
    this._geojsonLayer = L.geoJSON(null, {
      style: options.style,
      pointToLayer: options.pointToLayer,
      onEachFeature: options.onEachFeature,
    });
    this._tileFeatures = new Map();
  },
  createTile(coords) {
    const tile = L.DomUtil.create("div");
    const key = this._tileCoordsToKey(coords);
    this._tileFeatures.set(key, []);
    const url = L.Util.template(this._url, {
      x: coords.x,
      y: coords.y,
      z: coords.z,
    });
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!this._tileFeatures.has(key) || !data?.features) return;
        const added = [];
        data.features.forEach((f) => {
          const sub = L.geoJSON(f, {
            style: this.options.style,
            pointToLayer: this.options.pointToLayer,
            onEachFeature: this.options.onEachFeature,
          });
          this._geojsonLayer.addLayer(sub);
          added.push(sub);
        });
        this._tileFeatures.set(key, added);
      })
      .catch(() => {});
    return tile;
  },
  onAdd(map) {
    L.TileLayer.prototype.onAdd.call(this, map);
    this._geojsonLayer.addTo(map);
  },
  onRemove(map) {
    L.TileLayer.prototype.onRemove.call(this, map);
    this._geojsonLayer.remove();
    this._tileFeatures.clear();
  },
  _removeTile(key) {
    const layers = this._tileFeatures.get(key);
    if (layers) {
      layers.forEach((l) => this._geojsonLayer.removeLayer(l));
      this._tileFeatures.delete(key);
    }
    return L.TileLayer.prototype._removeTile.call(this, key);
  },
});

function buildCourseLayer() {
  return new GeoJsonTileLayer(
    `${YAMA_API}/course/get_course_GeoJSON.php?x={x}&y={y}&z={z}`,
    {
      attribution: YAMA_ATTR,
      minZoom: 11,
      maxZoom: MAX_ZOOM,
      minNativeZoom: 12,
      maxNativeZoom: 12,
      style: courseStyle,
    },
  );
}

function buildPointLayer() {
  return new GeoJsonTileLayer(
    `${YAMA_API}/course/get_point_GeoJSON.php?x={x}&y={y}&z={z}&all=1`,
    {
      attribution: YAMA_ATTR,
      minZoom: 12,
      maxZoom: MAX_ZOOM,
      minNativeZoom: 12,
      maxNativeZoom: 12,
      pointToLayer,
      onEachFeature: onEachPointFeature,
    },
  );
}

// ── OSM 側オーバーレイ ──
function buildWaymarkedHikingLayer() {
  return L.tileLayer(
    "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
    {
      maxZoom: 18,
      attribution:
        '登山道: <a href="https://hiking.waymarkedtrails.org/" target="_blank" rel="noreferrer">Waymarked Trails</a>',
      opacity: 0.85,
      zIndex: 50,
    },
  );
}

function buildGsiHillshadeLayer(paneName) {
  return L.tileLayer(
    "https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png",
    {
      maxZoom: 16,
      attribution:
        '陰影起伏図: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>',
      opacity: 1.0,
      pane: paneName,
    },
  );
}

const GSI_ATTR =
  '地図: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院タイル</a>';

const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';
const OSM_HOT_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | 地図: <a href="https://www.hotosm.org/" target="_blank" rel="noreferrer">Humanitarian OSM Team</a>, hosted by <a href="https://www.openstreetmap.fr/" target="_blank" rel="noreferrer">OSM France</a>';
const GOOGLE_ATTR =
  'Map data &copy; <a href="https://www.google.com/intl/ja/help/terms_maps/" target="_blank" rel="noreferrer">Google</a>';

// Google Maps の内部タイルエンドポイント。公式の Maps JavaScript API 経由では
// ないため利用規約の観点ではグレーだが、個人プロジェクトで広く使われるので
// option として提供する。`lyrs` で種別を切替: m=道路, s=航空, y=ハイブリッド, p=地形
const buildGoogleTileLayer = (lyrs) =>
  L.tileLayer(
    `https://mt{s}.google.com/vt/lyrs=${lyrs}&hl=ja&x={x}&y={y}&z={z}`,
    {
      subdomains: ["0", "1", "2", "3"],
      maxZoom: 20,
      attribution: GOOGLE_ATTR,
    },
  );

// ArcGIS Online の公開タイルサービス。service 名だけ差し替えれば使い回せる。
const buildEsriTileLayer = (service, { maxNativeZoom = 19, source = "" } = {}) =>
  L.tileLayer(
    `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
    {
      maxZoom: 19,
      maxNativeZoom,
      attribution: `Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>${source ? ` — ${source}` : ""}`,
    },
  );

// ── API キーが必要なプロバイダ ──
// `src/config.js` の値は window.SOUJI_MAPS_KEYS から読む。localStorage に
// "souji-maps-keys" が入っていればそちらを優先 (リポジトリに鍵を置きたく
// ないユーザ向け)。
const KEYS_DEFAULT = {
  thunderforest: "",
  maptiler: "",
  mapbox: "",
  stadia: { enabled: false },
};
function readApiKeys() {
  const fromFile = window.SOUJI_MAPS_KEYS || {};
  let fromStorage = {};
  try {
    const raw = localStorage.getItem("souji-maps-keys");
    if (raw) fromStorage = JSON.parse(raw) || {};
  } catch {
    // localStorage が使えない環境 (プライベートモード等) は無視
  }
  const stadia = {
    ...KEYS_DEFAULT.stadia,
    ...(fromFile.stadia || {}),
    ...(fromStorage.stadia || {}),
  };
  return {
    thunderforest: fromStorage.thunderforest || fromFile.thunderforest || "",
    maptiler: fromStorage.maptiler || fromFile.maptiler || "",
    mapbox: fromStorage.mapbox || fromFile.mapbox || "",
    stadia,
  };
}
const KEYS = readApiKeys();

const STADIA_ATTR =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const STAMEN_ATTR =
  '&copy; <a href="https://stamen.com/" target="_blank" rel="noreferrer">Stamen Design</a> &copy; <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const THUNDERFOREST_ATTR =
  'Maps &copy; <a href="https://www.thunderforest.com/" target="_blank" rel="noreferrer">Thunderforest</a>, Data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const MAPTILER_ATTR =
  '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const MAPBOX_ATTR =
  '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/about/" target="_blank" rel="noreferrer">OpenStreetMap</a>';

// Stadia はドメイン認可方式なので URL に鍵を載せない。Stamen 系スタイルは
// attribution に Stamen Design を含める必要がある。
const buildStadiaTileLayer = (
  style,
  { ext = "png", maxZoom = 20, attr = STADIA_ATTR } = {},
) =>
  L.tileLayer(
    `https://tiles.stadiamaps.com/tiles/${style}/{z}/{x}/{y}.${ext}`,
    { maxZoom, attribution: attr },
  );

const buildThunderforestTileLayer = (style) =>
  L.tileLayer(
    `https://{s}.tile.thunderforest.com/${style}/{z}/{x}/{y}.png?apikey=${encodeURIComponent(KEYS.thunderforest)}`,
    {
      subdomains: ["a", "b", "c"],
      maxZoom: 22,
      attribution: THUNDERFOREST_ATTR,
    },
  );

const buildMapTilerTileLayer = (style, ext = "png") =>
  L.tileLayer(
    `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.${ext}?key=${encodeURIComponent(KEYS.maptiler)}`,
    { maxZoom: 22, attribution: MAPTILER_ATTR },
  );

const buildMapboxTileLayer = (style) =>
  L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/256/{z}/{x}/{y}?access_token=${encodeURIComponent(KEYS.mapbox)}`,
    { maxZoom: 22, attribution: MAPBOX_ATTR },
  );

// Grouped so the <select> can render <optgroup>s. Entries are ordered by group
// and the group order here is the order the <optgroup>s appear in the menu.
const RIGHT_LAYERS = [
  // ── 標準地図 ──
  {
    group: "標準地図",
    name: "OpenStreetMap",
    linkHref: "https://www.openstreetmap.org/",
    linkText: "openstreetmap.org ↗",
    build: () =>
      // OSM Tile Usage Policy により Referer 必須。file:// では送られないので
      // http(s) 経由 (localhost など) で開くこと。
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: OSM_ATTR,
      }),
  },
  {
    group: "標準地図",
    name: "OSM Humanitarian",
    linkHref: "https://www.hotosm.org/",
    linkText: "hotosm.org ↗",
    build: () =>
      L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        subdomains: ["a", "b", "c"],
        maxZoom: 19,
        attribution: OSM_HOT_ATTR,
      }),
  },
  {
    group: "標準地図",
    name: "CARTO Voyager",
    linkHref: "https://carto.com/",
    linkText: "carto.com ↗",
    build: () =>
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        {
          subdomains: ["a", "b", "c", "d"],
          maxZoom: 20,
          attribution: CARTO_ATTR,
        },
      ),
  },
  {
    group: "標準地図",
    name: "Esri ストリート",
    linkHref: "https://www.esri.com/",
    linkText: "esri.com ↗",
    build: () =>
      buildEsriTileLayer("World_Street_Map", {
        source:
          "Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, OpenStreetMap contributors, and the GIS User Community",
      }),
  },

  // ── 淡色・ダーク ──
  {
    group: "淡色・ダーク",
    name: "CARTO Positron",
    linkHref: "https://carto.com/",
    linkText: "carto.com ↗",
    build: () =>
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        {
          subdomains: ["a", "b", "c", "d"],
          maxZoom: 20,
          attribution: CARTO_ATTR,
        },
      ),
  },
  {
    group: "淡色・ダーク",
    name: "CARTO Dark Matter",
    linkHref: "https://carto.com/",
    linkText: "carto.com ↗",
    build: () =>
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        {
          subdomains: ["a", "b", "c", "d"],
          maxZoom: 20,
          attribution: CARTO_ATTR,
        },
      ),
  },
  {
    group: "淡色・ダーク",
    name: "Esri グレーキャンバス",
    linkHref: "https://www.esri.com/",
    linkText: "esri.com ↗",
    build: () =>
      buildEsriTileLayer("Canvas/World_Light_Gray_Base", {
        maxNativeZoom: 16,
        source:
          "Esri, HERE, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors, and the GIS User Community",
      }),
  },
  {
    group: "淡色・ダーク",
    name: "Stadia Alidade Smooth Dark",
    linkHref: "https://stadiamaps.com/",
    linkText: "stadiamaps.com ↗",
    requires: KEYS.stadia.enabled,
    build: () => buildStadiaTileLayer("alidade_smooth_dark"),
  },
  {
    group: "淡色・ダーク",
    name: "Stamen Toner",
    linkHref: "https://stadiamaps.com/",
    linkText: "stadiamaps.com ↗",
    requires: KEYS.stadia.enabled,
    build: () => buildStadiaTileLayer("stamen_toner", { attr: STAMEN_ATTR }),
  },

  // ── Google Maps ──
  {
    group: "Google Maps",
    name: "Google 道路",
    linkHref: "https://www.google.com/maps",
    linkText: "google.com/maps ↗",
    build: () => buildGoogleTileLayer("m"),
  },
  {
    group: "Google Maps",
    name: "Google 地形",
    linkHref: "https://www.google.com/maps",
    linkText: "google.com/maps ↗",
    build: () => buildGoogleTileLayer("p"),
  },
  {
    group: "Google Maps",
    name: "Google 航空写真",
    linkHref: "https://www.google.com/maps",
    linkText: "google.com/maps ↗",
    build: () => buildGoogleTileLayer("s"),
  },
  {
    group: "Google Maps",
    name: "Google ハイブリッド",
    linkHref: "https://www.google.com/maps",
    linkText: "google.com/maps ↗",
    build: () => buildGoogleTileLayer("y"),
  },

  // ── 地理院 (日本) ──
  {
    group: "地理院 (日本)",
    name: "地理院 標準地図",
    linkHref: "https://maps.gsi.go.jp/",
    linkText: "maps.gsi.go.jp ↗",
    build: () =>
      L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: GSI_ATTR,
      }),
  },
  {
    group: "地理院 (日本)",
    name: "地理院 淡色地図",
    linkHref: "https://maps.gsi.go.jp/",
    linkText: "maps.gsi.go.jp ↗",
    build: () =>
      L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: GSI_ATTR,
      }),
  },
  {
    group: "地理院 (日本)",
    name: "地理院 白地図",
    linkHref: "https://maps.gsi.go.jp/",
    linkText: "maps.gsi.go.jp ↗",
    build: () =>
      L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png", {
        maxZoom: 14,
        attribution: GSI_ATTR,
      }),
  },
  {
    group: "地理院 (日本)",
    name: "地理院 色別標高図",
    linkHref: "https://maps.gsi.go.jp/",
    linkText: "maps.gsi.go.jp ↗",
    build: () =>
      L.tileLayer(
        "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png",
        {
          maxZoom: 15,
          attribution:
            '色別標高図: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>',
        },
      ),
  },

  // ── 地形・アウトドア ──
  {
    group: "地形・アウトドア",
    name: "OpenTopoMap",
    linkHref: "https://opentopomap.org/",
    linkText: "opentopomap.org ↗",
    build: () =>
      L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        subdomains: ["a", "b", "c"],
        maxZoom: 17,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | 地図: <a href="https://opentopomap.org/" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA)',
      }),
  },
  {
    group: "地形・アウトドア",
    name: "Esri 地形図",
    linkHref: "https://www.esri.com/",
    linkText: "esri.com ↗",
    build: () =>
      buildEsriTileLayer("World_Topo_Map", {
        source:
          "Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), OpenStreetMap contributors, and the GIS User Community",
      }),
  },
  {
    group: "地形・アウトドア",
    name: "Esri ナショジオ",
    linkHref: "https://www.esri.com/",
    linkText: "esri.com ↗",
    build: () =>
      buildEsriTileLayer("NatGeo_World_Map", {
        maxNativeZoom: 16,
        source:
          "National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC",
      }),
  },
  {
    group: "地形・アウトドア",
    name: "CyclOSM",
    linkHref: "https://www.cyclosm.org/",
    linkText: "cyclosm.org ↗",
    build: () =>
      L.tileLayer(
        "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
        {
          subdomains: ["a", "b", "c"],
          maxZoom: 20,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | 地図: <a href="https://www.cyclosm.org/" target="_blank" rel="noreferrer">CyclOSM</a>',
        },
      ),
  },
  {
    group: "地形・アウトドア",
    name: "Esri 海洋",
    linkHref: "https://www.esri.com/",
    linkText: "esri.com ↗",
    build: () =>
      buildEsriTileLayer("Ocean/World_Ocean_Base", {
        maxNativeZoom: 13,
        source:
          "Esri, GEBCO, NOAA, National Geographic, Garmin, HERE, Geonames.org, and other contributors",
      }),
  },
  {
    group: "地形・アウトドア",
    name: "Stadia Outdoors",
    linkHref: "https://stadiamaps.com/",
    linkText: "stadiamaps.com ↗",
    requires: KEYS.stadia.enabled,
    build: () => buildStadiaTileLayer("outdoors"),
  },
  {
    group: "地形・アウトドア",
    name: "Stamen Terrain",
    linkHref: "https://stadiamaps.com/",
    linkText: "stadiamaps.com ↗",
    requires: KEYS.stadia.enabled,
    build: () =>
      buildStadiaTileLayer("stamen_terrain", { maxZoom: 18, attr: STAMEN_ATTR }),
  },
  {
    group: "地形・アウトドア",
    name: "Thunderforest Outdoors",
    linkHref: "https://www.thunderforest.com/",
    linkText: "thunderforest.com ↗",
    requires: KEYS.thunderforest,
    build: () => buildThunderforestTileLayer("outdoors"),
  },
  {
    group: "地形・アウトドア",
    name: "Thunderforest Landscape",
    linkHref: "https://www.thunderforest.com/",
    linkText: "thunderforest.com ↗",
    requires: KEYS.thunderforest,
    build: () => buildThunderforestTileLayer("landscape"),
  },
  {
    group: "地形・アウトドア",
    name: "MapTiler Outdoor",
    linkHref: "https://www.maptiler.com/",
    linkText: "maptiler.com ↗",
    requires: KEYS.maptiler,
    build: () => buildMapTilerTileLayer("outdoor-v2"),
  },
  {
    group: "地形・アウトドア",
    name: "MapTiler Winter",
    linkHref: "https://www.maptiler.com/",
    linkText: "maptiler.com ↗",
    requires: KEYS.maptiler,
    build: () => buildMapTilerTileLayer("winter-v2"),
  },
  {
    group: "地形・アウトドア",
    name: "Mapbox Outdoors",
    linkHref: "https://www.mapbox.com/",
    linkText: "mapbox.com ↗",
    requires: KEYS.mapbox,
    build: () => buildMapboxTileLayer("outdoors-v12"),
  },

  // ── 衛星・空中写真 ──
  {
    group: "衛星・空中写真",
    name: "地理院 空中写真",
    linkHref: "https://maps.gsi.go.jp/",
    linkText: "maps.gsi.go.jp ↗",
    build: () =>
      L.tileLayer(
        "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
        {
          maxZoom: 18,
          attribution:
            '空中写真: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>',
        },
      ),
  },
  {
    group: "衛星・空中写真",
    name: "Esri 衛星写真",
    linkHref: "https://www.esri.com/",
    linkText: "esri.com ↗",
    build: () =>
      buildEsriTileLayer("World_Imagery", {
        source:
          "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      }),
  },
  {
    group: "衛星・空中写真",
    name: "Mapbox 衛星ストリート",
    linkHref: "https://www.mapbox.com/",
    linkText: "mapbox.com ↗",
    requires: KEYS.mapbox,
    build: () => buildMapboxTileLayer("satellite-streets-v12"),
  },
];

// ── 地名検索 (Nominatim) ──
// OSM の公開ジオコーダで山名・地名・駅名を横断検索する。Usage Policy の
// 目安 (1 req/sec, Referer 必須) を守るため、入力は debounce + クエリ単位の
// メモ化で抑える。結果は class/type でカテゴリ分類し、山・駅・集落など
// 日本語バッジと種別ごとの zoom で表示する。
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const SEARCH_DEBOUNCE_MS = 220; // 通常の入力 (確定済み文字の追加)
const SEARCH_COMPOSITION_END_MS = 60; // IME 確定直後は体感ほぼ即時で再検索
const SEARCH_FETCH_LIMIT = 12; // Nominatim に要求する件数
const SEARCH_DISPLAY_LIMIT = 8; // 並べ替え後にリストへ出す件数
const SEARCH_CACHE = new Map();

// rank is used to reorder Nominatim results client-side: e.g. "新宿駅" returns
// many highway/footway station-exit nodes before the actual railway/station.
// Lower rank wins. Ties fall back to Nominatim's own importance ordering.
function classifySearchResult(r) {
  // jsonv2 renames `class` to `category`; keep both paths so either format works.
  const cls = r.class ?? r.category;
  const typ = r.type;
  if (cls === "natural") {
    if (typ === "peak") return { label: "山", zoom: 14, rank: 10 };
    if (typ === "volcano") return { label: "火山", zoom: 14, rank: 10 };
    if (typ === "valley") return { label: "谷", zoom: 13, rank: 15 };
    if (typ === "ridge") return { label: "尾根", zoom: 13, rank: 15 };
    if (typ === "water") return { label: "水域", zoom: 13, rank: 15 };
    if (typ === "cape") return { label: "岬", zoom: 13, rank: 15 };
  }
  if (cls === "railway") {
    if (typ === "station" || typ === "halt" || typ === "tram_stop") {
      return { label: "駅", zoom: 15, rank: 20 };
    }
    if (typ === "subway_entrance" || typ === "train_station_entrance") {
      return { label: "駅入口", zoom: 16, rank: 28 };
    }
  }
  if (cls === "highway" && typ === "bus_stop") return { label: "バス停", zoom: 16, rank: 25 };
  if (cls === "place") {
    if (typ === "city" || typ === "town") return { label: "市町", zoom: 12, rank: 30 };
    if (typ === "village" || typ === "hamlet") return { label: "集落", zoom: 14, rank: 30 };
    if (typ === "suburb" || typ === "neighbourhood" || typ === "quarter") {
      return { label: "地区", zoom: 14, rank: 35 };
    }
    if (typ === "island") return { label: "島", zoom: 11, rank: 30 };
    if (typ === "locality") return { label: "地名", zoom: 13, rank: 35 };
  }
  if (cls === "tourism") {
    if (typ === "alpine_hut" || typ === "wilderness_hut") return { label: "山小屋", zoom: 15, rank: 40 };
    if (typ === "camp_site") return { label: "キャンプ場", zoom: 15, rank: 40 };
    if (typ === "viewpoint") return { label: "展望", zoom: 15, rank: 40 };
    if (typ === "attraction") return { label: "名所", zoom: 15, rank: 45 };
  }
  if (cls === "amenity") {
    if (typ === "parking") return { label: "駐車場", zoom: 16, rank: 50 };
    if (typ === "shelter") return { label: "避難所", zoom: 16, rank: 50 };
  }
  if (cls === "boundary") return { label: "行政区", zoom: 11, rank: 60 };
  if (cls === "waterway") return { label: "水系", zoom: 13, rank: 60 };
  return { label: "", zoom: 14, rank: 90 };
}

function sortByRank(results) {
  return results
    .map((r, i) => ({ r, i, rank: classifySearchResult(r).rank }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, SEARCH_DISPLAY_LIMIT)
    .map(({ r }) => r);
}

async function fetchSearch(query) {
  const q = query.trim();
  if (!q) return [];
  if (SEARCH_CACHE.has(q)) return SEARCH_CACHE.get(q);
  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    countrycodes: "jp",
    "accept-language": "ja",
    limit: String(SEARCH_FETCH_LIMIT),
    addressdetails: "1",
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  SEARCH_CACHE.set(q, data);
  return data;
}

function firstSegment(displayName) {
  return String(displayName || "").split(",")[0].trim();
}

function setupSearch(onSelect) {
  const input = document.getElementById("search-input");
  const list = document.getElementById("search-results");
  if (!input || !list) return;

  let debounceT = null;
  let reqSeq = 0;
  let items = [];
  let activeIdx = -1;

  const setExpanded = (open) => {
    input.setAttribute("aria-expanded", String(open));
    list.hidden = !open;
  };

  const hide = () => {
    items = [];
    activeIdx = -1;
    list.replaceChildren();
    setExpanded(false);
  };

  const setActive = (idx) => {
    const lis = list.querySelectorAll(".search-item");
    lis.forEach((el, i) => el.classList.toggle("active", i === idx));
    activeIdx = idx;
    if (idx >= 0 && lis[idx]) {
      lis[idx].scrollIntoView({ block: "nearest" });
    }
  };

  const choose = (idx) => {
    const r = items[idx];
    if (!r) return;
    const meta = classifySearchResult(r);
    onSelect(Number(r.lat), Number(r.lon), meta.zoom);
    input.value = r.name || firstSegment(r.display_name);
    hide();
    input.blur();
  };

  const render = (results) => {
    items = results;
    list.replaceChildren();
    if (results.length === 0) {
      const empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "該当なし";
      list.appendChild(empty);
      setExpanded(true);
      activeIdx = -1;
      return;
    }
    results.forEach((r, i) => {
      const meta = classifySearchResult(r);
      const title = r.name || firstSegment(r.display_name);

      const li = document.createElement("li");
      li.className = "search-item";
      li.setAttribute("role", "option");
      li.dataset.idx = String(i);

      if (meta.label) {
        const badge = document.createElement("span");
        badge.className = "search-badge";
        badge.textContent = meta.label;
        li.appendChild(badge);
      }

      const text = document.createElement("span");
      text.className = "search-text";

      const titleEl = document.createElement("span");
      titleEl.className = "search-title";
      titleEl.textContent = title;

      const subEl = document.createElement("span");
      subEl.className = "search-sub";
      subEl.textContent = r.display_name || "";

      text.append(titleEl, subEl);
      li.appendChild(text);

      // mousedown + preventDefault so the input keeps focus until click fires.
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(i);
      });
      li.addEventListener("mouseenter", () => setActive(i));
      list.appendChild(li);
    });
    setExpanded(true);
    activeIdx = -1;
  };

  const runSearch = async (q) => {
    const seq = ++reqSeq;
    try {
      const results = await fetchSearch(q);
      if (seq !== reqSeq) return;
      render(sortByRank(results));
    } catch {
      if (seq !== reqSeq) return;
      hide();
    }
  };

  const schedule = (delay) => {
    clearTimeout(debounceT);
    const q = input.value.trim();
    if (!q) {
      hide();
      return;
    }
    debounceT = setTimeout(() => runSearch(q), delay);
  };

  // IME 変換中も `input` を通してインクリメンタルに候補を出す。ひらがな/
  // カタカナでも Nominatim は name:ja にヒットすることがあり、確定前から
  // 有用な候補が並ぶ。無駄打ちは debounce + クエリキャッシュで抑える。
  input.addEventListener("input", () => schedule(SEARCH_DEBOUNCE_MS));

  // 確定直後は短い遅延で再検索して体感遅延を最小化。同じクエリなら
  // SEARCH_CACHE ヒットで fetch は発生しない。
  input.addEventListener("compositionend", () => schedule(SEARCH_COMPOSITION_END_MS));

  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (list.hidden || items.length === 0) {
      if (e.key === "Enter" && input.value.trim()) {
        e.preventDefault();
        clearTimeout(debounceT);
        runSearch(input.value.trim());
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(items.length - 1, activeIdx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIdx <= 0 ? items.length - 1 : activeIdx - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(activeIdx >= 0 ? activeIdx : 0);
    } else if (e.key === "Escape") {
      e.preventDefault();
      hide();
      input.blur();
    }
  });

  input.addEventListener("focus", () => {
    if (items.length > 0) setExpanded(true);
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target === input) return;
    if (list.contains(e.target)) return;
    hide();
  });
}

function readInitialView() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const zoom = Number(params.get("z"));
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(zoom) &&
    zoom >= MIN_ZOOM &&
    zoom <= MAX_ZOOM
  ) {
    return { lat, lng, zoom, fromHash: true };
  }
  return { ...DEFAULT_VIEW, fromHash: false };
}

function tryMoveToCurrentLocation(map, { zoom = 14, timeoutMs = 8000 } = {}) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], Math.max(map.getZoom(), zoom), {
        animate: true,
      });
    },
    () => {
      // 権限拒否・取得失敗時は黙ってフォールバック座標のまま
    },
    { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
  );
}

function writeViewToHash(lat, lng, zoom) {
  const params = new URLSearchParams();
  params.set("lat", lat.toFixed(5));
  params.set("lng", lng.toFixed(5));
  params.set("z", String(zoom));
  const next = `#${params.toString()}`;
  if (next !== window.location.hash) {
    window.history.replaceState(null, "", next);
  }
}

function createMap(elementId, layerPreset, initial, { addDefault = true } = {}) {
  const map = L.map(elementId, {
    center: [initial.lat, initial.lng],
    zoom: initial.zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomControl: true,
    worldCopyJump: true,
    preferCanvas: true,
  });
  if (addDefault) layerPreset.build().addTo(map);
  return map;
}

// Bidirectional synchronization. A simple mutex-style guard prevents feedback
// loops when we programmatically move the other map.
function linkMaps(a, b, onChange) {
  let syncing = false;

  const sync = (from, to) => {
    if (syncing) return;
    syncing = true;
    try {
      const center = from.getCenter();
      const zoom = from.getZoom();
      to.setView(center, zoom, { animate: false, noMoveStart: true });
      onChange(center, zoom);
    } finally {
      syncing = false;
    }
  };

  a.on("move zoom", () => sync(a, b));
  b.on("move zoom", () => sync(b, a));
}

// ── GPX drag & drop overlay ──
// White casing under the pink line / halo behind waypoints for high contrast
// against any basemap (Strava/RWGPS-style).
const GPX_TRACK_CASING_STYLE = {
  color: "#ffffff",
  weight: 8,
  opacity: 0.95,
};
const GPX_TRACK_STYLE = {
  color: "#ec4899",
  weight: 4,
  opacity: 1,
};
const GPX_WAYPOINT_HALO_STYLE = {
  radius: 8,
  color: "#ffffff",
  fillColor: "#ffffff",
  fillOpacity: 1,
  weight: 0,
};
const GPX_WAYPOINT_STYLE = {
  radius: 5,
  color: "#ec4899",
  fillColor: "#ffffff",
  fillOpacity: 1,
  weight: 2,
};

// XML namespaces in GPX make querySelector unreliable across browsers.
// getElementsByTagName matches local names, so we use it throughout.
function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;

  const tracks = [];
  Array.from(doc.getElementsByTagName("trk")).forEach((trk) => {
    Array.from(trk.getElementsByTagName("trkseg")).forEach((seg) => {
      const pts = [];
      Array.from(seg.getElementsByTagName("trkpt")).forEach((p) => {
        const lat = Number(p.getAttribute("lat"));
        const lng = Number(p.getAttribute("lon"));
        if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lat, lng]);
      });
      if (pts.length) tracks.push(pts);
    });
  });

  Array.from(doc.getElementsByTagName("rte")).forEach((rte) => {
    const pts = [];
    Array.from(rte.getElementsByTagName("rtept")).forEach((p) => {
      const lat = Number(p.getAttribute("lat"));
      const lng = Number(p.getAttribute("lon"));
      if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lat, lng]);
    });
    if (pts.length) tracks.push(pts);
  });

  const waypoints = [];
  Array.from(doc.getElementsByTagName("wpt")).forEach((p) => {
    const lat = Number(p.getAttribute("lat"));
    const lng = Number(p.getAttribute("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const nameEl = p.getElementsByTagName("name")[0];
    const name = nameEl?.textContent?.trim() || "";
    waypoints.push({ lat, lng, name });
  });

  const metaName = doc.getElementsByTagName("metadata")[0]
    ?.getElementsByTagName("name")[0]?.textContent?.trim();
  const trkName = doc.getElementsByTagName("trk")[0]
    ?.getElementsByTagName("name")[0]?.textContent?.trim();
  const name = metaName || trkName || "";

  return { tracks, waypoints, name };
}

function buildGpxLayer(gpx) {
  const layer = L.featureGroup();
  const popupHtml = gpx.name ? `<strong>${escapeHtml(gpx.name)}</strong>` : "";
  // Casings first so colored strokes paint on top (canvas renderer respects add order).
  gpx.tracks.forEach((pts) => {
    layer.addLayer(L.polyline(pts, GPX_TRACK_CASING_STYLE));
  });
  gpx.tracks.forEach((pts) => {
    const line = L.polyline(pts, GPX_TRACK_STYLE);
    if (popupHtml) line.bindPopup(popupHtml, { autoPan: false });
    layer.addLayer(line);
  });
  gpx.waypoints.forEach((wpt) => {
    layer.addLayer(L.circleMarker([wpt.lat, wpt.lng], GPX_WAYPOINT_HALO_STYLE));
    const marker = L.circleMarker([wpt.lat, wpt.lng], GPX_WAYPOINT_STYLE);
    if (wpt.name) marker.bindPopup(escapeHtml(wpt.name), { autoPan: false });
    layer.addLayer(marker);
  });
  return layer;
}

function setupGpxDrop(maps, clearButton) {
  const overlay = document.createElement("div");
  overlay.className = "drop-overlay";
  overlay.innerHTML =
    '<div class="drop-overlay-text">GPX をドロップして表示</div>';
  document.body.appendChild(overlay);

  // Track [{leftLayer, rightLayer}] so we can remove cleanly later.
  const loaded = [];
  let dragDepth = 0;

  const isFileDrag = (e) =>
    Array.from(e.dataTransfer?.types || []).includes("Files");

  const showOverlay = (show) => {
    overlay.classList.toggle("show", show);
  };

  const updateClearButton = () => {
    clearButton.hidden = loaded.length === 0;
  };

  window.addEventListener("dragenter", (e) => {
    if (!isFileDrag(e)) return;
    dragDepth++;
    showOverlay(true);
  });
  window.addEventListener("dragleave", (e) => {
    if (!isFileDrag(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) showOverlay(false);
  });
  window.addEventListener("dragover", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  });
  window.addEventListener("drop", async (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth = 0;
    showOverlay(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.gpx$/i.test(f.name),
    );
    if (files.length === 0) {
      showToast("GPX ファイルではありません");
      return;
    }

    let totalBounds = null;
    let lastName = "";
    for (const file of files) {
      try {
        const text = await file.text();
        const gpx = parseGpx(text);
        if (!gpx || (gpx.tracks.length === 0 && gpx.waypoints.length === 0)) {
          showToast(`${file.name}: ルート/地点が見つかりません`);
          continue;
        }
        const layers = maps.map((m) => {
          const layer = buildGpxLayer(gpx);
          layer.addTo(m);
          return layer;
        });
        loaded.push(layers);
        const bounds = layers[0].getBounds();
        if (bounds.isValid()) {
          totalBounds = totalBounds ? totalBounds.extend(bounds) : bounds;
        }
        lastName = gpx.name || file.name;
      } catch (err) {
        showToast(`${file.name}: 読み込み失敗 (${err.message})`);
      }
    }

    if (totalBounds) {
      // fitBounds on one map; linkMaps will sync the other.
      maps[0].fitBounds(totalBounds, { padding: [40, 40] });
      showToast(`${lastName} を表示しました`);
    }
    updateClearButton();
  });

  clearButton.addEventListener("click", () => {
    loaded.forEach((layers) => {
      layers.forEach((l, i) => maps[i].removeLayer(l));
    });
    loaded.length = 0;
    updateClearButton();
    showToast("GPX をクリアしました");
  });
}

// Drag the central splitter to resize the two panes. Works for both
// horizontal (desktop) and vertical (mobile / .vertical class) layouts.
function makeSplitterDraggable(splitEl, splitterEl, onResize) {
  const verticalMQ = window.matchMedia("(max-width: 768px)");
  const isVertical = () =>
    verticalMQ.matches || splitEl.classList.contains("vertical");

  let dragging = false;
  let rafId = null;
  let pendingPct = 50;

  const apply = (pct) => {
    const clamped = Math.max(15, Math.min(85, pct));
    if (isVertical()) {
      splitEl.style.gridTemplateRows = `${clamped}% 6px ${100 - clamped}%`;
      splitEl.style.gridTemplateColumns = "";
    } else {
      splitEl.style.gridTemplateColumns = `${clamped}% 6px ${100 - clamped}%`;
      splitEl.style.gridTemplateRows = "";
    }
    onResize();
  };

  const schedule = (pct) => {
    pendingPct = pct;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      apply(pendingPct);
    });
  };

  const computePct = (clientX, clientY) => {
    const rect = splitEl.getBoundingClientRect();
    return isVertical()
      ? ((clientY - rect.top) / rect.height) * 100
      : ((clientX - rect.left) / rect.width) * 100;
  };

  const onDown = (e) => {
    dragging = true;
    splitterEl.classList.add("dragging");
    document.body.style.cursor = isVertical() ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const point = e.touches ? e.touches[0] : e;
    e.preventDefault();
    schedule(computePct(point.clientX, point.clientY));
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    splitterEl.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const reset = () => {
    splitEl.style.gridTemplateColumns = "";
    splitEl.style.gridTemplateRows = "";
    onResize();
  };

  splitterEl.addEventListener("mousedown", onDown);
  splitterEl.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);
  window.addEventListener("touchcancel", onUp);
  splitterEl.addEventListener("dblclick", reset);

  // Wipe inline sizes when orientation flips so the new axis starts at 50/50.
  const onMqChange = () => reset();
  if (verticalMQ.addEventListener) verticalMQ.addEventListener("change", onMqChange);
  else verticalMQ.addListener(onMqChange);
}

function showToast(text) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
}

function updateStatus(center) {
  document.getElementById("status-lat").textContent = center.lat.toFixed(5);
  document.getElementById("status-lng").textContent = center.lng.toFixed(5);
}

// ── User preferences (localStorage) ──
// Persist overlay toggles and the right-pane basemap so repeat visits land in
// the same state. URL hash still owns position/zoom — prefs only cover layer
// selection. Private mode / disabled storage is tolerated silently.
const PREFS_KEY = "souji-maps-prefs";
function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writePrefs(patch) {
  try {
    const next = { ...readPrefs(), ...patch };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — just drop the write
  }
}

// Wire an overlay-control to localStorage. `overlays` is the same name→layer
// object passed to L.control.layers; `defaultsOn` is the Set of names that
// start enabled when no prefs exist. Layers whose names appear in the saved
// list are added to the map; subsequent toggles persist automatically.
function setupPersistentOverlays(map, overlays, defaultsOn, prefsKey) {
  const saved = readPrefs()[prefsKey];
  const initialOn = Array.isArray(saved)
    ? new Set(saved.filter((n) => n in overlays))
    : defaultsOn;
  Object.entries(overlays).forEach(([name, layer]) => {
    if (initialOn.has(name)) layer.addTo(map);
  });
  const persist = () => {
    const on = Object.entries(overlays)
      .filter(([, layer]) => map.hasLayer(layer))
      .map(([name]) => name);
    writePrefs({ [prefsKey]: on });
  };
  map.on("overlayadd overlayremove", persist);
}

// Presets may declare a `requires` field (API key / feature flag). When it's
// present, the preset is included only if the value is truthy — lets the
// dropdown hide providers the user hasn't configured.
const isPresetEnabled = (preset) =>
  !("requires" in preset) || Boolean(preset.requires);

// Build every active right-side basemap up front. Keeping all layer instances
// around means the <select>-based switcher can swap them without rebuilding.
function buildRightBasemaps() {
  return RIGHT_LAYERS.filter(isPresetEnabled).map((preset) => ({
    preset,
    layer: preset.build(),
  }));
}

// Update the right pane header's external link and aria-label to match the
// active basemap. The <select> itself is the title, so we don't write text.
function applyRightPaneHeader(preset) {
  const section = document.querySelector('section[data-side="right"]');
  if (!section) return;
  section.setAttribute("aria-label", `${preset.name} 地図`);
  const linkEl = section.querySelector(".pane-link");
  if (linkEl) {
    linkEl.href = preset.linkHref;
    linkEl.textContent = preset.linkText;
  }
}

// Populate the <select> with one <option> per preset, wrapping each run of
// presets that share a `group` in an <optgroup>. Presets must already be
// ordered so that items of the same group are contiguous — otherwise the
// same group label would render more than once.
function populateRightBasemapSelect(basemaps, selectedIdx) {
  const selectEl = document.getElementById("right-basemap-select");
  if (!selectEl) return null;
  selectEl.replaceChildren();
  let currentGroup = null;
  let parent = selectEl;
  basemaps.forEach(({ preset }, idx) => {
    const group = preset.group || "";
    if (group !== currentGroup) {
      currentGroup = group;
      if (group) {
        parent = document.createElement("optgroup");
        parent.label = group;
        selectEl.appendChild(parent);
      } else {
        parent = selectEl;
      }
    }
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = preset.name;
    parent.appendChild(opt);
  });
  selectEl.value = String(selectedIdx);
  return selectEl;
}

function init() {
  const initial = readInitialView();
  const mapLeft = createMap("map-left", LEFT_LAYERS[0], initial);
  const mapRight = createMap("map-right", RIGHT_LAYERS[0], initial, { addDefault: false });

  const handleChange = (center, zoom) => {
    updateStatus(center);
    writeViewToHash(center.lat, center.lng, zoom);
  };

  linkMaps(mapLeft, mapRight, handleChange);
  handleChange(mapLeft.getCenter(), mapLeft.getZoom());

  // 共有リンクで開かれた場合 (fromHash=true) はその位置を尊重。
  // そうでなければ起動時に現在地取得を試みる。
  if (!initial.fromHash) {
    tryMoveToCurrentLocation(mapLeft);
  }

  // ヤマレコ由来オーバーレイ。Leaflet 標準の L.control.layers で切替。
  const footprintOverlays = Object.fromEntries(
    Object.entries(FOOTPRINT_TYPES).map(([label, type]) => [
      `みんなの足跡 (${label})`,
      buildFootprintLayer(type),
    ]),
  );
  const courseLayer = buildCourseLayer();
  const pointLayer = buildPointLayer();

  const leftOverlays = {
    登山道: courseLayer,
    "山頂・山小屋・登山口など": pointLayer,
    ...footprintOverlays,
  };
  setupPersistentOverlays(
    mapLeft,
    leftOverlays,
    new Set(["登山道", "山頂・山小屋・登山口など", "みんなの足跡 (夏期)"]),
    "leftOverlays",
  );
  L.control
    .layers(null, leftOverlays, { collapsed: true, position: "topright" })
    .addTo(mapLeft);

  // 右ペインの basemap はヘッダの <select> で切り替える。prefs に保存された
  // preset 名があればそれを初期選択に、無ければ RIGHT_LAYERS[0] を使う。
  const rightBasemaps = buildRightBasemaps();
  const savedBasemapName = readPrefs().rightBasemap;
  const savedBasemapIdx = rightBasemaps.findIndex(
    ({ preset }) => preset.name === savedBasemapName,
  );
  const initialBasemapIdx = savedBasemapIdx >= 0 ? savedBasemapIdx : 0;
  let activeRightBasemap = rightBasemaps[initialBasemapIdx];
  activeRightBasemap.layer.addTo(mapRight);
  applyRightPaneHeader(activeRightBasemap.preset);
  const basemapSelect = populateRightBasemapSelect(rightBasemaps, initialBasemapIdx);
  basemapSelect?.addEventListener("change", () => {
    const next = rightBasemaps[Number(basemapSelect.value)];
    if (!next || next === activeRightBasemap) return;
    mapRight.removeLayer(activeRightBasemap.layer);
    next.layer.addTo(mapRight);
    activeRightBasemap = next;
    applyRightPaneHeader(next.preset);
    writePrefs({ rightBasemap: next.preset.name });
  });

  // OSM 側のオーバーレイ
  // 陰影用の専用 pane を作り、mix-blend-mode: soft-light で地形を重ねる。
  // multiply だと陰部分が強く効いて全体が暗くなるので、明度を大きく変えず
  // コントラストだけ付ける soft-light を採用。
  mapRight.createPane("hillshadePane");
  const hillshadePane = mapRight.getPane("hillshadePane");
  hillshadePane.style.zIndex = 250; // tilePane(200) の上、overlayPane(400) の下
  hillshadePane.style.mixBlendMode = "soft-light";
  hillshadePane.style.pointerEvents = "none";
  hillshadePane.style.filter = "contrast(1.2)"; // soft-light は効果が柔らかいので少し強める

  const waymarkedLayer = buildWaymarkedHikingLayer();
  const hillshadeLayer = buildGsiHillshadeLayer("hillshadePane");
  const rightOverlays = {
    "登山道 (Waymarked Trails)": waymarkedLayer,
    "陰影起伏図 (地理院)": hillshadeLayer,
  };
  setupPersistentOverlays(
    mapRight,
    rightOverlays,
    new Set(["登山道 (Waymarked Trails)", "陰影起伏図 (地理院)"]),
    "rightOverlays",
  );
  L.control
    .layers(null, rightOverlays, { collapsed: true, position: "topright" })
    .addTo(mapRight);

  // Ensure both maps size correctly after layout settles.
  requestAnimationFrame(() => {
    mapLeft.invalidateSize();
    mapRight.invalidateSize();
  });

  window.addEventListener("resize", () => {
    mapLeft.invalidateSize();
    mapRight.invalidateSize();
  });

  const splitEl = document.getElementById("split");
  const splitterEl = splitEl.querySelector(".splitter");
  splitterEl.title = "ドラッグでサイズ調整 / ダブルクリックで均等";
  makeSplitterDraggable(splitEl, splitterEl, () => {
    mapLeft.invalidateSize();
    mapRight.invalidateSize();
  });

  document.getElementById("btn-locate").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("この端末は位置情報に対応していません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapLeft.setView([latitude, longitude], Math.max(mapLeft.getZoom(), 14));
      },
      (err) => {
        showToast(`現在地を取得できません (${err.message})`);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });


  setupSearch((lat, lng, zoom) => {
    // linkMaps が右ペインへ同期するので、左ペインだけ setView すれば十分。
    mapLeft.setView([lat, lng], zoom, { animate: true });
  });

  setupGpxDrop([mapLeft, mapRight], document.getElementById("btn-clear-gpx"));

  document.getElementById("btn-copy-url").addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast("現在位置のURLをコピーしました");
    } catch {
      showToast("コピーに失敗しました");
    }
  });

}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
