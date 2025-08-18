### BFFのAPIエンドポイント設計（外部公開）

1つの画面を表示するための情報を1つのAPIで返せるように設計

※N+1問題に注意する

※複数のテーブルを一度に更新するときは、どれか失敗したらすべての更新をロールバックする

※実績記録、タスクサービス関連更新は全て、親タスクのtask_authで権限を確認する

フロントエンドはBFFのみと通信する。以下で後述する各サービスのAPIは内部（BFFからのみアクセス）であり、外部公開しない。

| メソッド | エンドポイント | 説明 | 内部での呼び出し先サービス | 対象テーブル |
| --- | --- | --- | --- | --- |
| POST | /api/v1/register | **ユーザー登録** | ユーザー・権限サービス | users |
| POST | /api/v1/login | **ログイン**し、認証トークン(JWT等)を取得 | ユーザー・権限サービス | users |
| POST | /api/v1/logout | **ログアウト** | - | - |
| GET | /api/v1/tasks | ログイン中のユーザーが**閲覧可能なタスク一覧**を取得 | ①ユーザー・権限サービス　②タスクサービス | users　task_auths　tasks |
| POST | /api/v1/tasks | **新規タスクを作成** (サブタスク, 計画も一括で) また作成者はuser_authで自動的にwrite権限で追加 | ①タスクサービス　②ユーザー・権限サービス | task_auths　tasks　subtasks　daily_work_plans　daily_time_plans |
| GET PUT DELETE | /api/v1/tasks/{taskId} | **特定のタスク詳細**を取得 (サブタスク, 権限等も含む)　**タスクを更新**　**タスクを削除**　実績記録は削除しない | ①タスクサービス　②ユーザー・権限サービス | task_auths　tasks　subtasks　daily_work_plans　daily_time_plans |
| POST | /api/v1/subtasks/{subtaskId}/records | **作業実績を記録**　サブタスク経由でしか新規作成はできない | ①タスクサービス　②ユーザー・権限サービス　③実績記録サービス | task_auths　tasks　subtasks　record_works |
| PUT
DELETE | /api/v1/records/{recordId} | **作業実績を編集・削除** | 実績記録サービス | record_works |
| GET | /api/v1/dashboard/tasks | トップページ用グラフデータを一括取得（`task_relation.md` 準拠でBFFが集計） | ①ユーザー・権限サービス ②タスクサービス ③実績記録サービス | users task_auths tasks subtasks record_works |
| GET | /api/v1/tasks/{taskId}/graph | 単一タスクのグラフデータ（進捗・作業時間等）を取得 | ①タスクサービス ②実績記録サービス | tasks subtasks record_works |

---

### ユーザー・権限サービス (User & Auth Service)

**責務:** ユーザー情報の管理、認証、およびタスクに対する認可（権限）情報の管理。

注記: 本章のAPIは内部API（BFFからのみアクセス）。外部公開しない。

| **メソッド** | **エンドポイント** | **説明** |
| --- | --- | --- |
| POST | /api/v1/users | 新規ユーザーを作成する。 |
| GET | /api/v1/users/me | 認証トークンに基づき、自身のユーザー情報を取得する。 |
| PUT | /api/v1/users/me | 自身のユーザー情報（名前、メール、パスワード等）を更新する。 |
| DELETE | /api/v1/users/me | 自身のアカウントを削除する（退会機能）。 |
| POST | /api/v1/auth/token | ユーザー名とパスワードで認証し、認証トークン(JWT等)を発行する。 |
| GET | /api/v1/auths/tasks?user_id={userId} | **[BFF連携]** 指定したユーザーが権限を持つtask_idのリストを返す。 |
| GET | /api/v1/tasks/{taskId}/auths | 特定のタスクに権限を持つユーザーの一覧を取得する（共有メンバー表示用）。 |
| POST | /api/v1/tasks/{taskId}/auths | 特定のタスクに、指定したユーザーの権限を追加する（タスク共有機能）。 |
| PUT | /api/v1/tasks/{taskId}/auths/{userId} | 特定タスクの、特定ユーザーの権限を更新する（例: Read→Write）。 |
| DELETE | /api/v1/tasks/{taskId}/auths/{userId} | 特定タスクから、特定ユーザーの権限を削除する（共有解除）。 |

---

### タスクサービス (Task Service)

**責務:** アプリケーションのコアであるタスク、サブタスク、計画のライフサイクル管理。

注記: 本章のAPIは内部API（BFFからのみアクセス）。外部公開しない。

| **メソッド** | **エンドポイント** | **説明** |
| --- | --- | --- |
| GET | /api/v1/tasks?ids={id1},{id2},...&include=subtasks,plans | **[BFF連携]** 複数IDのタスクを一括取得。`include` で `subtasks`（`contribution_value` を含む）や `plans` を同梱可能。 |
| POST | /api/v1/tasks | 新規タスクを作成する（サブタスク、計画もリクエストに含めて一括作成可能）。 |
| GET | /api/v1/tasks/{taskId} | 特定タスクの詳細情報を取得する（サブタスク、計画も含む）。 |
| PUT | /api/v1/tasks/{taskId} | 特定タスクの基本情報（名前、カテゴリ等）を更新する。 |
| DELETE | /api/v1/tasks/{taskId} | 特定のタスクを削除する（サブタスク、計画も同時に削除される）。 |
| GET | /api/v1/subtasks/{subtaskId} | **[他サービス連携]** 特定サブタスクの存在と基本情報を確認する。 |
| POST | /api/v1/tasks/{taskId}/subtasks | 既存のタスクに、新しいサブタスクを追加する。 |
| PUT | /api/v1/subtasks/{subtaskId} | 特定のサブタスク情報を更新する。 |
| DELETE | /api/v1/subtasks/{subtaskId} | 特定のサブタスクを削除する。 |
| PUT | /api/v1/tasks/{taskId}/plans | 特定タスクの日々の計画をまとめて更新する（Upsert: なければ作成、あれば更新）。 |

---

### 実績記録サービス (Record Service)

**責務:** サブタスクに対する作業実績の記録と管理。

注記: 本章のAPIは内部API（BFFからのみアクセス）。外部公開しない。

| **メソッド** | **エンドポイント** | **説明** |
| --- | --- | --- |
| POST | /api/v1/subtasks/{subtaskId}/records | 特定のサブタスクに紐づく作業実績を新規に記録する。 |
| GET | /api/v1/subtasks/{subtaskId}/records | 特定のサブタスクに記録された実績の一覧を取得する。 |
| GET | /api/v1/tasks/{taskId}/records | 特定のタスクに紐づく全てのサブタスクの実績をまとめて取得する（サマリー表示用）。 |
| GET | /api/v1/users/{userId}/records | 特定のユーザーが記録した実績を期間などで絞り込んで取得する（レポート機能用）。 |
| PUT | /api/v1/records/{recordId} | 特定の作業実績を更新する（時間やメモの修正）。 |
| DELETE | /api/v1/records/{recordId} | 特定の作業実績を削除する。 |
| POST | /api/v1/records/summary/by_subtask_ids | `subtask_ids: number[]` を受け取り、サブタスク毎に `sum_progress_value`（0..100にクランプ）, `sum_work_time` を返す。BFFのグラフ集計用の一括API。 |

### 設計のポイント解説

- **BFFの役割:** クライアントはBFFのことだけを考えればOKです。BFFが裏側で「ユーザー・権限サービスに問い合わせて権限を確認し、次にタスクサービスに問い合わせて実データを取得する」といった**オーケストレーション（調整役）**を一手に引き受けます。
- **IDによる一括取得:** BFFがタスク一覧を作る際、N+1問題を避けるために、タスクサービスは?ids=...のように複数のIDを一度に受け取って結果を返すAPIを用意するのが効率的です。
-
- **公開/内部の境界:** 外部公開はBFFのみ。各サービスは内部APIとしてBFFからのみアクセスされる（例: 外部は `https://api.example.com`、内部は `http://task-service` などのサービスDNS）。
- **task_relation準拠の集計:** トップページやタスク詳細のグラフ用データはBFFで `design_docs/task_relation.md` の定義に基づき集計し返却する。
- **認可の統一:** 書き込み系は親タスクの `task_auth` による権限チェックを必須とする。BFF→各サービス間はサービス間トークンやmTLS等の内部認証を前提とする。