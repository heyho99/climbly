# Climbly BFF (FastAPI)

## 起動方法（開発）

```bash
python -m venv .venv
. .venv/bin/activate  # Windows(PowerShell): .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- ヘルスチェック: http://localhost:8000/api/v1/health
- 仮ログイン: `POST /api/v1/login` → `{ "access_token": "dev-token" }`
- `GET /api/v1/users/me` は `Authorization: Bearer dev-token` のとき 200
- `GET /api/v1/tasks` はダミーデータ返却

本実装では JWT/権限確認/マイクロサービス連携に置換予定。
