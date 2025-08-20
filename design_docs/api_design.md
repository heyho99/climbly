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
  - 出力: `{ user, token }`
- POST `/v1/auth/login`
  - 入力: `username_or_email`, `password`
  - 出力: `{ user, token }`
- POST `/v1/auth/logout`
  - 入力: なし（サーバ側トークン失効/クライアント破棄）

Users:
- GET `/v1/users/me`
  - 出力: 自ユーザー情報（`users`）
- PATCH `/v1/users/me`
  - 入力: `email?`, `password?`
  - 出力: 更新後ユーザー

TaskAuths（v2で拡充想定）:
- GET `/v1/task_auths?task_id=...`
- POST `/v1/task_auths`（v2）
  - 入力: `task_id`, `user_id`, `task_user_auth`（`read|write|admin`）
- PATCH `/v1/task_auths/{task_auth_id}`（v2）
- DELETE `/v1/task_auths/{task_auth_id}`（v2）

---

## task-service（タスク・日次計画）

Tasks（`tasks`）:
- GET `/v1/tasks?mine=true&status=active&category=...&page=...`
  - v1要件: 自分が作成者のタスクのみ
- POST `/v1/tasks`
  - 入力: `task_name`, `task_content`, `start_at`, `end_at`, `category(study|creation|other)`, `target_time`, `comment?`
  - 出力: 作成された `task`
- GET `/v1/tasks/{task_id}`
- PATCH `/v1/tasks/{task_id}`
- DELETE `/v1/tasks/{task_id}`
  - 参照制約により関連の扱いは整合（[pages.md](cci:7://file://wsl.localhost/Ubuntu/home/ouchi/climbly/design_docs/pages.md:0:0-0:0)の方針参照）

Daily Plans（`daily_plans`）:
- GET `/v1/tasks/{task_id}/daily_plans?from=YYYY-MM-DD&to=YYYY-MM-DD`
- PUT `/v1/tasks/{task_id}/daily_plans/bulk`
  - 入力: `[{ target_date, work_plan_value, time_plan_value }, ...]`
  - バリデーション:
    - `Σ(work_plan_value) = 100`
    - `Σ(time_plan_value) = tasks.target_time`
- PATCH `/v1/daily_plans/{daily_time_plan_id}`
- DELETE `/v1/daily_plans/{daily_time_plan_id}`

---

## record-service（実績記録・集計）

Record Works（`record_works`）:
- GET `/v1/record_works?task_id=&from=&to=&page=...`
- POST `/v1/record_works`
  - 入力: `task_id`, `start_at`, `end_at`, `progress_value(0-100)`, `work_time`, `note?`
- GET `/v1/record_works/{record_work_id}`
- PATCH `/v1/record_works/{record_work_id}`
- DELETE `/v1/record_works/{record_work_id}`

Metrics（ダッシュボード/グラフ用）:
- GET `/v1/metrics/works/daily?from=&to=&task_id=`
  - 出力: `[{ date, total_work_time, total_progress_delta }, ...]`
- GET `/v1/metrics/tasks/summary`
  - 出力（例）:
    - 現在進行中のタスク数
    - 累計タスク完了数
    - 今月のタスク完了数
    - 今月/累計の作業時間

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
- GET `/bff/v1/records?mode=by_task|journal&task_id=&from=&to=&page=...`
- POST `/bff/v1/records`
- PATCH `/bff/v1/records/{record_work_id}`
- DELETE `/bff/v1/records/{record_work_id}`

---

## データモデル対応（抜粋）

- users, task_auths（user-service）
- tasks, daily_plans（task-service）
- record_works（record-service）
- subtasks（subtask-service・v2）