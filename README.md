# Souji Maps (双耳マップ)

PC / Mac / iPad などの大きな画面向けの Web アプリ。左にヤマレコ、右に OpenStreetMap の地図を並べ、
両者を同期させながら山域の情報を比較できます。

🌐 **公開 URL**: https://yakkun.github.io/SoujiMaps/

サービス名は「双耳峰」にちなんでいます。

## 特徴

- **左右同期スクロール / ズーム**: どちらの地図を動かしても、もう一方が追従します。
- **URL 共有**: 現在地と縮尺が URL ハッシュに書き込まれるため、そのまま共有すれば同じ位置を開けます。
- **レスポンシブ**: 狭い画面では上下2分割に自動で切り替わります。
- **ゼロビルド**: `./serve.sh` を起動してブラウザで開くだけで動きます。

## 使い方

1. ローカルサーバーを起動してブラウザで開きます。
   右ペインが OpenStreetMap 本家タイルを利用している関係で、`file://` で直接開くと
   Referer が送られず 403 でブロックされます。必ず http(s) 経由で開いてください。

   ```sh
   ./serve.sh        # → http://127.0.0.1:5173/ を開く
   # あるいは
   python3 -m http.server 5173 --bind 127.0.0.1
   ```

2. 地図をドラッグ / ピンチで操作すると、左右が同期します。
3. ヘッダーのボタン:
   - `📍 現在地`: 端末の位置情報で移動
   - `🔗 URLコピー`: 現在位置の共有リンクをコピー

## タイルについて

- **左 (ヤマレコ)**:
  - ベース: `https://{a,b,c}.yamatile.com/std/{z}/{x}/{y}.png` (ヤマレコ本体と同じ国土地理院ベース)
  - オーバーレイ (地図右上のレイヤーコントロールから個別 ON/OFF 可):
    - **登山道** (`socket.yamareco.com/v2/course/get_course_GeoJSON.php`) — type 別に色・破線を変えて描画 (一般/難路/バリエーション/沢/冬道/林道)
    - **山頂・山小屋・登山口など** (`socket.yamareco.com/v2/course/get_point_GeoJSON.php?all=1`) — ヤマレコ公式アイコン、クリックで名称・標高・詳細ページリンクをポップアップ表示
    - **みんなの足跡** (`yamareco.info/.../get_tileimg.php?type={夏期|冬期|沢・岩|スキー|すべて}`) — デフォルトは**夏期**のみ表示 (`opacity: 0.7`)
- **右 (OpenStreetMap)**:
  - ベース: `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (OSM 本家 Standard / OSM Carto スタイル)
    - [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) に従って Referer が送信される必要があるため、`file://` ではなく `./serve.sh` 経由で http(s) 起動する。
  - オーバーレイ (地図右上のレイヤーコントロールから個別 ON/OFF 可、デフォルトは両方 ON):
    - **登山道 (Waymarked Trails)** `https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png` — OSM 由来の登山道。ヤマレコの登山道レイヤーと比較できる。
    - **陰影起伏図 (地理院)** `https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png` — 山の凹凸を可視化。専用 pane で `mix-blend-mode: soft-light` を適用しているので、全体の輝度を落とさずに凹凸のコントラストだけ強調される。

各サービスの利用規約に従って個人的な閲覧・比較用途で使用してください。ビジュアルを切り替える場合は
`src/main.js` の `LEFT_LAYERS` / `RIGHT_LAYERS` を編集してください。

## ファイル構成

```
.
├── index.html
├── src/
│   ├── main.js
│   └── style.css
└── README.md
```
