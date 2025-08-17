次のステップとして、プロジェクト配下にフロントエンドとBFFの雛形ディレクトリ・最小ファイル群を作成します。作成は既存ファイルを壊さずに新規作成のみ行います。複数ファイルを同時に生成して効率化します。

フロントからBFFへ認証付きでアクセスするため、CORS設定を開発用オリジンに限定する修正を行います（`allow_credentials=True` と `"*"` の併用は適切でないため）。[bff/app/main.py](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/bff/app/main.py:0:0-0:0) を更新します。

# 雛形を作成しました
以下を新規作成しました。

- フロントエンド: `frontend/`
  - 主要ファイル: [public/index.html](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/frontend/public/index.html:0:0-0:0), [src/main.js](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/frontend/src/main.js:0:0-0:0), [src/router/index.js](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/frontend/src/router/index.js:0:0-0:0), [src/pages/login.js](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/frontend/src/pages/login.js:0:0-0:0), [src/pages/dashboard.js](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/frontend/src/pages/dashboard.js:0:0-0:0), `src/api/*`, [src/styles/style.css](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/frontend/src/styles/style.css:0:0-0:0)
- BFF(FastAPI): `bff/`
  - 主要ファイル: [app/main.py](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/bff/app/main.py:0:0-0:0), [requirements.txt](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/bff/requirements.txt:0:0-0:0), [README.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/bff/README.md:0:0-0:0)

BFFはデモ用トークンで最小API（`/api/v1/login`, `/api/v1/users/me`, `/api/v1/tasks`）を返します。CORSは開発用に `http://localhost:5173` のみ許可に設定しています（[bff/app/main.py](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/bff/app/main.py:0:0-0:0)）。

# 起動手順（提案）
- __BFF__: ポート8000で起動
- __フロント__: 簡易サーバでプロジェクトルートを配信（ポート5173）
  - ブラウザで `http://localhost:5173/frontend/public/` を開きます
  - index.html から `/api/v1/...` へリクエスト → `http://localhost:8000/api/v1/...` に到達（同一オリジンではないのでCORS設定済）

以下のコマンドを実行提案します（ユーザー承認後に実行されます）。

- __BFF 起動（依存インストール含む）__（cwd: `bff/`）
  ```
  python -m venv .venv; .\.venv\Scripts\python -m pip install -r requirements.txt; .\.venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```
- __フロント配信（プロジェクトルート配信）__（cwd: リポジトリルート）
  ```
  python -m http.server 5173
  ```

実行しましょうか？承認いただければ自動で起動します。

# 次の確認ポイント
- __ログインページ__ `#/login` で任意のID/パスワードでログイン可（デモトークンを返却）
- __ダッシュボード__ `#/dashboard` でタスクのダミーデータと簡易グラフ表示
- CORSがブロックされないか（BFFログやブラウザコンソールで確認）

# 補足
- 本実装に進む際は、BFFのダミー認証（`dev-token`）をJWT＋リフレッシュ運用へ置換し、[api_design.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/design_docs/api_design.md:0:0-0:0) に基づく各サービス連携へ拡張します。

実行の承認をいただければ、上記2つのサーバ起動まで進めます。