# サービス IO 契約（v1）

このドキュメントは、フロントエンドと各バックエンドサービス（BFF・Task・Record・User）の間で取り交わすリクエスト/レスポンス（I/O）を一覧化し、変更時の影響範囲と実装ポイントを明確にするためのものです。

- 対象バージョン: 現行コードベース（FastAPI v1系実装）
- パス表記: 実サービスのベースパスを含む
  - BFF: `/bff/v1`
  - task-service: `/v1`
  - record-service: `/v1`
  - user-service: `/v1`

## 共通事項

- 認証
  - 原則として Authorization: `Bearer <JWT>` を要求します。
  - 例外:
    - BFF `POST /auth/login`, `POST /auth/register`, `POST /auth/logout` は不要。
    - BFF `GET /dashboard/*` はトークン無しでも動作するが、取得値は 0/空になる可能性あり。
- エラーフォーマット
  - サービス側は `HTTPException` を多用。レスポンスは以下のいずれか:
    - `{ "message": string, ... }`
    - `{ "detail": { "message": string, ... } }`
  - フロントのラッパ（`frontend/js/api.js`）は `err.message || err.detail?.message` を参照。
- 日付/日時
  - 日時は ISO 8601 文字列（例: `2025-10-26T10:30:00`）。一部で `Z` を付与/非付与混在のため、クライアント側で寛容に扱うこと。

---

# BFF（/bff/v1）

- 認証ヘッダは基本的に下流サービスへ透過（`authorization` を転送）。
- BFF独自の集約/合成APIあり（ダッシュボード、`tasks_with_plans` など）。

## Auth

- POST `/auth/login`
  - Body: `{ username_or_email: string, password: string }`
  - Res: `{ token: string, user: UserOut }`
- POST `/auth/register`
  - Body: `{ username: string, email: string, password: string }`
  - Res: `{ token: string, user: UserOut }`
- POST `/auth/logout`
  - Body: なし
  - Res: `{ ok: true }`

## Users

- GET `/users/me`
  - Auth: 必要
  - Res: `UserOut`

## Dashboard

- GET `/dashboard/summary`
  - Auth: 任意
  - Res: `{ active_tasks: number, completed_tasks_total: number, completed_tasks_this_month: number, work_time_this_month: number, work_time_total: number, lagging_tasks_count: number }`

- GET `/dashboard/lagging_tasks`
  - Auth: 任意
  - Res: `Array<{ task_id: number, task_name: string, progress_gap: number, work_plan_value: number, progress_value: number }>`

- GET `/dashboard/daily_plan_aggregate?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Res: `Array<{ target_date: YYYY-MM-DD, total_time_plan: number }>`

- GET `/dashboard/daily_record_aggregate?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Res: `Array<{ target_date: YYYY-MM-DD, total_work_time: number }>`

## Tasks（BFF 経由で task-service を委譲）

- GET `/tasks`
  - Query: `mine=bool(default true)`, `category=study|creation|other`, `status=active|completed|paused|cancelled`, `include_daily_plans=bool`, `include_actuals=bool`, `page`, `per_page`
  - Res: `{ items: Array<TaskOut & { daily_plans?: DailyPlanOut[], daily_actuals?: Array<{ target_date: string, work_actual_value: number, time_actual_value: number }>, summary_today?: { work_plan_cumulative: number, work_actual_cumulative: number, time_plan_cumulative: number, time_actual_cumulative: number } }>, page: number, per_page: number, total: number }`

- GET `/tasks/{task_id}`
  - Res: `{ task: TaskOut, daily_plans: DailyPlanOut[], records_summary: {} }`

- POST `/tasks`
  - Body: `TaskIn`
  - Res: `TaskOut`

- PATCH `/tasks/{task_id}`
  - Body: `TaskUpdate`
  - Res: `TaskOut`

- DELETE `/tasks/{task_id}`
  - Res: `{ ok: true }`

### Task Auths（BFF 経由で user-service を委譲）

- GET `/tasks/{task_id}/auths`
  - Res: `Array<{ task_auth_id: number, task_id: number, user_id: number, task_user_auth: 'read'|'write'|'admin', last_updated_user: number|null, created_at: ISODateTime, updated_at: ISODateTime }>`

- POST `/tasks/{task_id}/auths`
  - Body: `{ user_id: number, task_user_auth: 'read'|'write'|'admin' }`
  - Res: `TaskAuthOut`

- PATCH `/tasks/{task_id}/auths/{task_auth_id}`
  - Body: `{ task_user_auth: 'read'|'write'|'admin' }`
  - Res: `TaskAuthOut`

- DELETE `/tasks/{task_id}/auths/{task_auth_id}`
  - Res: `{ ok: true }`

### 合成API（BFF 独自）

- POST `/tasks_with_plans`
  - Body: `{ task: TaskIn, daily_plans: { items: DailyPlanBulkItem[] } }`
  - Res: `{ task: TaskOut, daily_plans_count: number }`

- PATCH `/tasks_with_plans/{task_id}`
  - Body: `{ task?: TaskUpdate, daily_plans: { items: DailyPlanBulkItem[] } }`
  - Res: `{ task: TaskOut, daily_plans_count: number }`

## Records（BFF 経由で record-service を委譲）

- GET `/records/by_task?task_id&from&to`
  - Res: `{ from?: string, to?: string, tasks: Array<{ task_id: number, task_title: string, assignees: [], records: Array<{ record_work_id: number, start_at: ISODateTime, end_at: ISODateTime, work_time: number, progress_value: number, note: string|null, created_by: number }> }>, total_tasks: number, total_records: number }`

- GET `/records/diary?from&to&page&per_page`
  - Res: `{ from?: string, to?: string, items: Array<{ record_work_id: number, task_id: number, task_title?: string, start_at: ISODateTime, end_at: ISODateTime, work_time: number, progress_value: number, note: string|null }>, page: number, per_page: number, total: number }`

- GET `/records/{record_work_id}`
  - Res: `RecordOut`

- POST `/records`
  - Body: `RecordIn`
  - Res: `RecordOut`

- PATCH `/records/{record_work_id}`
  - Body: `RecordUpdate`
  - Res: `RecordOut`

- DELETE `/records/{record_work_id}`
  - Res: `{ ok: true }`

---

# task-service（/v1）

## Tasks

- GET `/tasks?mine&category&status`
  - Res: `TaskOut[]`
- POST `/tasks`
  - Body: `TaskIn`
  - Res: `TaskOut`
- GET `/tasks/{task_id}`
  - Res: `TaskOut`
- PATCH `/tasks/{task_id}`
  - Body: `TaskUpdate`
  - Res: `TaskOut`
- DELETE `/tasks/{task_id}`
  - Res: `{ ok: true }`

## Daily Plans

- GET `/tasks/{task_id}/daily_plans?from&to`
  - Res: `DailyPlanOut[]`
- PUT `/tasks/{task_id}/daily_plans/bulk`
  - Body: `DailyPlanBulkItem[]`
  - Res: `{ ok: true, upserted: number, pruned: number }`
- GET `/daily_plans/latest_progress?task_id`
  - Res: `{ task_id: number, work_plan_value: number, target_date: string|null }`
- GET `/daily_plans/aggregate?from&to`
  - Res: `Array<{ target_date: YYYY-MM-DD, total_time_plan: number }>`

### Schemas（抜粋）
- `TaskIn`: `{ task_name, task_content, start_at, end_at, category: 'study'|'creation'|'other', target_time, comment?, status: 'active'|'completed'|'paused'|'cancelled' }`
- `TaskUpdate`: 上記の任意項目
- `TaskOut`: `{ task_id, created_by, task_name, task_content, start_at, end_at, category, target_time, comment?, status, created_at, updated_at }`
- `DailyPlanOut`: `{ daily_time_plan_id, task_id, created_by, target_date(YYYY-MM-DD), work_plan_value, time_plan_value, created_at, updated_at }`
- `DailyPlanBulkItem`: `{ target_date(YYYY-MM-DD), work_plan_value>=0, time_plan_value>=0 }`

---

# record-service（/v1）

## Records

- GET `/records?task_id&from&to&page&per_page`
  - Res: `RecordOut[]`
- GET `/records/latest_progress?task_id`
  - Res: `{ task_id: number, progress_value: number, start_at: ISODateTime|null }`
- GET `/records/daily_aggregate?from&to`
  - Res: `Array<{ target_date: YYYY-MM-DD, total_work_time: number }>`
- GET `/records/by_task?task_id&from&to`
  - Res: `{ from?: string, to?: string, tasks: Array<{ task_id: number, task_title: string, assignees: [], records: Array<{ record_work_id: number, start_at: ISODateTime, end_at: ISODateTime, work_time: number, progress_value: number, note: string|null, created_by: number }> }>, total_tasks: number, total_records: number }`
- GET `/records/{record_work_id}`
  - Res: `RecordOut`
- POST `/records`
  - Body: `RecordIn`
  - Res: `RecordOut`
- PATCH `/records/{record_work_id}`
  - Body: `RecordUpdate`
  - Res: `RecordOut`
- DELETE `/records/{record_work_id}`
  - Res: `{ ok: true }`

## Metrics

- GET `/metrics/work_time/summary?from&to`
  - Res: `{ total_work_time: number }`

### Schemas（抜粋）
- `RecordIn`: `{ task_id, start_at, end_at, progress_value>=0, work_time>=0, note? }`
- `RecordUpdate`: 上記の任意項目
- `RecordOut`: `{ record_work_id, task_id, created_by, start_at, end_at, progress_value, work_time, note?, last_updated_user?, created_at, updated_at }`

---

# user-service（/v1）

## Auth / Users

- POST `/auth/register`
  - Body: `{ username, email, password }`
  - Res: `{ token, user: UserOut }`
- POST `/auth/login`
  - Body: `{ username_or_email, password }`
  - Res: `{ token, user: UserOut }`
- POST `/auth/logout`
  - Res: `{ ok: true }`
- GET `/users/me`
  - Res: `UserOut`

## Task Auths

- GET `/task_auths?task_id`
  - Res: `Array<{ task_auth_id, task_id, user_id, task_user_auth, last_updated_user?, created_at, updated_at }>`（admin で task_id 指定時は対象タスクの全メンバー返却。それ以外は自分の行のみ）
- POST `/task_auths`
  - Body: `{ task_id, user_id, task_user_auth: 'read'|'write'|'admin' }`
  - Res: `TaskAuthOut`
- PATCH `/task_auths/{task_auth_id}`
  - Body: `{ task_user_auth: 'read'|'write'|'admin' }`
  - Res: `TaskAuthOut`
- DELETE `/task_auths/{task_auth_id}`
  - Res: `{ ok: true }`

### Schemas（抜粋）
- `UserOut`: `{ user_id, username, email, is_active, last_login_at?, created_at, updated_at }`
- `TaskAuthIn/Out/Update`: 上記参照

---

# Frontend 関数 ↔ BFF エンドポイント対応

- Auth
  - `api.login` → POST `/auth/login`
  - `api.register` → POST `/auth/register`
  - `api.me` → GET `/users/me`
- Dashboard
  - `api.dashboardSummary` → GET `/dashboard/summary`
  - `api.laggingTasks` → GET `/dashboard/lagging_tasks`
  - `api.dashboardDailyPlanAggregate` → GET `/dashboard/daily_plan_aggregate`
  - `api.dashboardDailyRecordAggregate` → GET `/dashboard/daily_record_aggregate`
- Tasks
  - `api.listTasks` → GET `/tasks`
  - `api.getTask` → GET `/tasks/{task_id}`
  - `api.updateTask` → PATCH `/tasks/{task_id}`
  - `api.deleteTask` → DELETE `/tasks/{task_id}`
  - `api.listTaskAuths` → GET `/tasks/{task_id}/auths`
  - `api.createTaskAuth` → POST `/tasks/{task_id}/auths`
  - `api.updateTaskAuth` → PATCH `/tasks/{task_id}/auths/{task_auth_id}`
  - `api.deleteTaskAuth` → DELETE `/tasks/{task_id}/auths/{task_auth_id}`
  - `api.createTaskWithPlans` → POST `/tasks_with_plans`
  - `api.updateTaskWithPlans` → PATCH `/tasks_with_plans/{task_id}`
- Records
  - `api.listRecords`/`api.listRecordsDiary` → GET `/records/diary`
  - `api.listRecordsByTask` → GET `/records/by_task`
  - `api.createRecord` → POST `/records`
  - `api.getRecord` → GET `/records/{id}`
  - `api.updateRecord` → PATCH `/records/{id}`
  - `api.deleteRecord` → DELETE `/records/{id}`

---

# 実装/運用上の注意（Gotchas）

- 認証ヘッダの透過
  - BFFは `authorization` ヘッダをそのまま下流へ転送します（欠落時、下流で401）。
  - BFFの一部（records系）は明示的にトークン必須。dashboard系は任意。
- 合計値検証（計画）
  - `tasks_with_plans` と `PUT /tasks/{id}/daily_plans/bulk` は、`max(work_plan_value) == 100` かつ `sum(time_plan_value) == task.target_time` を要求。
- エラーハンドリング
  - BFFは下流のエラー JSON をそのまま返すことがあるため、フロントは `message`/`detail.message` の両方を扱う。
- 日付/時刻
  - `daily_aggregate`/`aggregate` は日付キーで返却。レコードは ISO 8601 文字列。タイムゾーン表記は混在し得るためパースは寛容に。
