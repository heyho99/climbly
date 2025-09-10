erDiagram
    users ||--o{ tasks : "作成する"
    users||--o{ task_auths : "持つ"
    tasks ||--o{ task_auths : "関連付ける"
    tasks ||--o{ daily_plans : "日毎の作業予定"
    tasks ||--o{ record_works : "記録する"
    tasks ||--o{ subtasks : "持つ"

    users {
        int user_id PK
        varchar username
        varchar password
        varchar email "ログイン通知やパスワードリセット用"
        boolean is_active "無効化フラグ"
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }
    
    task_auths {
        int task_auth_id PK
        int task_id FK
        int user_id FK "ユーザ毎にタスクの権限持つ"
        varchar task_user_auth "read/write/admin"
        int last_updated_user FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    tasks {
        int task_id PK
        int created_by FK "user_id"
        varchar task_name
        text task_content
        timestamptz start_at "開始予定日時"
        timestamptz end_at "終了予定日時"
        varchar category "study/creation/other"
        int target_time
        text comment
        varchar status "active/completed/paused/cancelled"
        int last_updated_user FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    record_works {
        int record_work_id PK
        int task_id FK
        int created_by FK "実績入力した人"
        timestamptz start_at "日時に対応(日をまたぐ場合は別々に作成)"
        timestamptz end_at "日時に対応(日をまたぐ場合は別々に作成)"
        int progress_value "進捗値(0-100),累積値"
        int work_time "作業時間は日毎の時間を入力"
        text note "作業メモ"
        int last_updated_user FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    daily_plans {
        int daily_time_plan_id PK
        int task_id FK
        int created_by FK
        date target_date "カレンダー連携必要無いのでdate"
        int work_plan_value "整数値,作業予定値(0-100),累積値"
        int time_plan_value "整数値,作業時間予定は日毎の時間を入力"
        int last_updated_user FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    subtasks {
        int subtask_id PK
        int task_id FK
        int created_by FK "user_id"
        varchar subtask_name
        text subtask_content
        varchar status "to Do/Doing/Done"
        timestamptz start_at "開始予定日時"
        timestamptz end_at "終了予定日時"
        text comment
        int last_updated_user FK
        timestamptz created_at
        timestamptz updated_at
    }    
