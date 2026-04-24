#!/usr/bin/env bash
# Launch a local HTTP server so that tile.openstreetmap.org accepts requests
# (it rejects file:// origins because no Referer is sent).
set -euo pipefail
PORT="${1:-5173}"
cd "$(dirname "$0")"
echo "Souji Maps → http://127.0.0.1:${PORT}/"
exec python3 -m http.server "${PORT}" --bind 127.0.0.1
