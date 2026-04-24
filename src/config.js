// Souji Maps — API key configuration for optional basemap providers.
//
// Each provider below has a free tier; once you fill in a key (or flip
// `stadia.enabled` to true), the right-pane basemap dropdown gains the
// matching presets. Empty strings / `false` keep those presets hidden.
//
// ── Where to get free keys ──────────────────────────────────────────────
//   thunderforest : https://manage.thunderforest.com/              (150,000 tiles / month)
//   maptiler      : https://cloud.maptiler.com/account/keys/        (100,000 tiles / month)
//   mapbox        : https://account.mapbox.com/access-tokens/       (50,000 map loads / month)
//   stadia        : https://client.stadiamaps.com/                  (200,000 map loads / month)
//                   — domain-authenticated; no key goes in the URL.
//                   Register your site (e.g. localhost, yakkun.github.io)
//                   in the Stadia dashboard, then set `stadia.enabled: true`.
//                   Stamen styles (Toner / Terrain / Watercolor) are served
//                   through the same Stadia account.
//
// ── Committing keys to a public repo ────────────────────────────────────
// Anything written here is shipped in plain JS to every visitor. Before
// committing a real key, lock it down in the provider dashboard:
//   • HTTP Referer / Origin allowlist → just your site (yakkun.github.io,
//     localhost, 127.0.0.1, etc.).
// If you'd rather not commit keys at all, keep this file empty and set
// the keys in your browser console instead:
//   localStorage.setItem("souji-maps-keys", JSON.stringify({ thunderforest: "KEY", ... }))
// Values in localStorage override this file at runtime.

window.SOUJI_MAPS_KEYS = {
  thunderforest: "9ba5c57d0a4c450bab094a64a88a3527",
  maptiler: "dKhzDtusNM0oeNlImdWP",
  mapbox: "pk.eyJ1IjoieWFra3VuIiwiYSI6ImNtb2N2aXd3MjA1NDgzMXBlb2c2MjRrZGwifQ.MAo18e4kNOnS5zy-AtfwmQ",
  stadia: {
    enabled: true,
  },
};
