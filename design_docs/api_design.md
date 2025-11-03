# API Design (v1)

本ドキュメントは [README.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/design_docs/README.md:0:0-0:0), [pages.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/design_docs/pages.md:0:0-0:0), [er_diagram.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/design_docs/er_diagram.md:0:0-0:0), [service_nw.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/design_docs/service_nw.md:0:0-0:0) に整合する v1 API の設計です。BFF がフロントからの要求を受け、各サービス（user, task, record, subtask）を仲介します。認証は JWT（Bearer）を想定。

## 共通仕様

- ベースパス: /v1（各サービス内）
- 認証: HTTP Header `Authorization: Bearer <JWT>`
- ページング: `page`（1始まり）, `per_page`（既定=50, 最大=200）
- ソート: `sort`（カラム名）, `order`（asc|desc）
- エラー形式:
  - `{ "code": "string", "message": "string", "details": { ... } }`
- ステータスコード方針:
  - 200/201/204: 成功
  - 400: バリデーションエラー
  - 401: 未認証
  - 403: 権限不足（v2以降の委譲権限）
  - 404: 対象なし
  - 409: 整合性競合
  - 422: 形式不正
  - 500: サーバエラー

## セキュリティ/権限（段階適用）

- v1: 自分が作成者(`tasks.created_by`)のタスクのみ参照・編集・削除可（[README.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/design_docs/README.md:0:0-0:0)）
- v2: `task_auths` による read/write/admin 委譲を導入

---

## user-service（ユーザー・認証・権限）

Auth:
- POST `/v1/auth/register`
  - 入力: `username`, `email`, `password`
  - 出力: `{ token, user }`
- POST `/v1/auth/login`
  - 入力: `username_or_email`, `password`
  - 出力: `{ token, user }`
- POST `/v1/auth/logout`
  - 入力: なし（JWTはクライアント破棄）

Users:
- GET `/v1/users/me`
  - 出力: ログインユーザー情報（`user_id`, `username`, `email`, `is_active`, `last_login_at`, `created_at`, `updated_at`）

TaskAuths（v1は参照・作成のみ）:
- GET `/v1/task_auths?task_id=`
  - `task_id` 指定時はそのタスクの自身の権限のみ、未指定時は自分が紐づく全タスクの権限一覧
- POST `/v1/task_auths`
  - 入力: `task_id`, `user_id`, `task_user_auth(read|write|admin)`
  - 既に同じ組み合わせが存在する場合は409

---

## task-service（タスク・日次計画）

Tasks（`tasks`）:
- GET `/v1/tasks?mine=true&status=active&category=...`
  - `mine=true` の場合は user-service の `/task_auths` を参照し、アクセス権のあるタスクIDのみ返却
  - `status` は `active|completed|paused|cancelled` のみ指定可能
- POST `/v1/tasks`
  - 入力: `task_name`, `task_content`, `start_at`, `end_at`, `category`, `target_time`, `comment?`, `status`
  - 作成後に user-service の `/task_auths` へ `admin` 権限を登録（失敗時はタスクをロールバック削除）
- GET `/v1/tasks/{task_id}`
- PATCH `/v1/tasks/{task_id}`
  - 更新可能なフィールド: `task_name`, `task_content`, `start_at`, `end_at`, `category`, `target_time`, `comment`, `status`
- DELETE `/v1/tasks/{task_id}`
  - 外部キーで `daily_plans` は ON DELETE CASCADE

Daily Plans（`daily_plans`）:
- GET `/v1/tasks/{task_id}/daily_plans?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `from` / `to` は任意。指定がない場合は全日付を昇順で返却
- PUT `/v1/tasks/{task_id}/daily_plans/bulk`
  - 入力: `[{ target_date, work_plan_value, time_plan_value }, ...]`
  - バリデーション:
    - `work_plan_value` は累積値として扱うため最大値が 100 であること
    - `Σ(time_plan_value) = tasks.target_time`
  - 入力に含まれない日付の `daily_plans` は削除
- GET `/v1/daily_plans/latest_progress?task_id=`
  - 今日時点の最新計画進捗（`work_plan_value`）を返却
- GET `/v1/daily_plans/aggregate?from=&to=`
  - アクセス可能なタスク群の `time_plan_value` を日付集計

---

## record-service（実績記録・集計）

Record Works（`record_works`）:
- GET `/v1/records?task_id=&from=&to=&page=&per_page=`
  - `from`/`to` は `start_at`・`end_at` でフィルタ、`page`/`per_page(<=100)` でページング
  - `created_by` が自分のレコードのみ取得
- GET `/v1/records/latest_progress?task_id=`
  - 指定タスクの最新実績進捗 (`progress_value`) を返却
- GET `/v1/records/daily_aggregate?from=&to=`
  - `start_at` を日単位に集計し、`total_work_time`（分）を返却
- GET `/v1/records/by_task?task_id=&from=&to=`
  - タスクIDごとに実績をグループ化して返却（カンバン表示向け）
- GET `/v1/records/{record_work_id}`
- POST `/v1/records`
  - 入力: `task_id`, `start_at`, `end_at`, `progress_value(0-100)`, `work_time`, `note?`
  - `created_by` は認証ユーザーで固定
- PATCH `/v1/records/{record_work_id}`
  - 更新フィールド: `start_at`, `end_at`, `progress_value`, `work_time`, `note`
  - 更新時に `last_updated_user`・`updated_at` を自動更新
- DELETE `/v1/records/{record_work_id}`

Metrics（ダッシュボード/集計用）:
- GET `/v1/metrics/work_time/summary?from=&to=`
  - 指定期間の作業時間合計（分）を返却

---

## subtask-service（サブタスク：v2以降）

Subtasks（`subtasks`）:
- GET `/v1/tasks/{task_id}/subtasks`
- POST `/v1/tasks/{task_id}/subtasks`
  - 入力: `subtask_name`, `subtask_content?`, `status(to Do|Doing|Done)`, `start_at?`, `end_at?`, `comment?`
- GET `/v1/subtasks/{subtask_id}`
- PATCH `/v1/subtasks/{subtask_id}`
- DELETE `/v1/subtasks/{subtask_id}`

---

## BFF（フロント専用集約API）

Auth（user-service へ委譲）:
- POST `/bff/v1/auth/register`
- POST `/bff/v1/auth/login`
- POST `/bff/v1/auth/logout`
- GET `/bff/v1/users/me`
- PATCH `/bff/v1/users/me`

Dashboard:
- GET `/bff/v1/dashboard/summary`
  - 出力: 数値データ（現在進行中タスク数、累計/今月完了数、今月/累計作業時間）
- GET `/bff/v1/dashboard/lagging_tasks`
  - ロジック:
    - (進捗率合計) − (開始日から今日までの計画進捗累積) < 0
    - (作業時間合計) − (開始日から今日までの計画時間累積) < 0
  - 出力: 該当タスク一覧

Tasks（グラフ同梱ビュー）:
- GET `/bff/v1/tasks?mine=true&category=&page=...`
  - 各タスクに計画/実績の折れ線データを付与
- GET `/bff/v1/tasks/{task_id}`
  - タスク詳細 + 日次計画 + 実績サマリ
- POST `/bff/v1/tasks`
  - 入力: タスク情報 + 日次計画
  - 補助: `allow_auto_distribution=true` で均等割をサーバ側生成
  - 処理順: task作成 → daily_plans作成 → バリデーション
- PATCH `/bff/v1/tasks/{task_id}`
- DELETE `/bff/v1/tasks/{task_id}`

Records（実績記録ビュー）:
- GET `/bff/v1/records/by_task?task_id=&from=&to=`
  - タスク別実績一覧（カンバン表示用）
- GET `/bff/v1/records/diary?page=&per_page=&from=&to=`
  - 時系列実績一覧（日記形式）
- POST `/bff/v1/records`
- PATCH `/bff/v1/records/{record_work_id}`
- DELETE `/bff/v1/records/{record_work_id}`

---

## データモデル対応（抜粋）

- users, task_auths（user-service）
- tasks, daily_plans（task-service）
- record_works（record-service）
- subtasks（subtask-service・v2）