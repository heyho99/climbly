# Climbly Frontend

生の HTML/CSS/JS によるシングルページフロント。BFF(`/bff/v1`) 経由でバックエンドと通信します。

## 起動

静的ファイルとして配信してください（例: VSCode Live Server、`python -m http.server` 等）。

デフォルトのBFFベースURLは `http://localhost:8081` です。変更する場合は `index.html` の `window.BFF_BASE_URL` を編集してください。

## 構成

- `index.html`: エントリ
- `styles/main.css`: スタイル
- `js/app.js`: ルーティング・レイアウト
- `js/router.js`: ハッシュベースルーター
- `js/api.js`: BFF APIクライアント（JWT保管は localStorage）
- `js/auth.js`: 認証ユーティリティ
- `js/views/*`: 画面

## 画面

- ログイン
- ダッシュボード（サマリ・遅延タスク）
- タスク一覧 / 作成 / 編集 / 削除
- 実績記録一覧

## 注意

- バックエンド未起動時はAPI呼び出しに失敗します（UI上は簡易メッセージ表示）。
- 追加要件（グラフの描画、詳細メトリクス、日次計画のGUI編集など）は今後拡張予定です。
